// 入口必须在最前加载 .env，保证后续模块能读到环境变量
import './env.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, runMigrations } from './db.js';
import { signToken, authRequired, adminRequired } from './auth.js';
import { difyUrl, difyUser } from './dify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 启动初始化 ----------
runMigrations();

// users 表为空时，根据环境变量创建首个管理员
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const { ADMIN_USER, ADMIN_PASSWD } = process.env;
  if (ADMIN_USER && ADMIN_PASSWD) {
    const hash = bcrypt.hashSync(ADMIN_PASSWD, 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
      ADMIN_USER,
      hash
    );
    console.log(`[init] 已创建首个管理员账号: ${ADMIN_USER}`);
  } else {
    console.warn('[warn] users 表为空，但未配置 ADMIN_USER/ADMIN_PASSWD，无法创建初始管理员！');
  }
}

const app = express();
app.use(express.json());

// 统一错误格式
const err = (res, status, message) => res.status(status).json({ error: message });
// 包装异步路由，异常走统一错误处理
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- 公开接口 ----------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return err(res, 400, '用户名和密码不能为空');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return err(res, 401, '用户名或密码错误');
  }
  res.json({
    token: signToken(user),
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// ---------- 登录后接口 ----------
app.get('/api/auth/me', authRequired, (req, res) => {
  const { id, username, role } = req.user;
  res.json({ id, username, role });
});

app.get('/api/conversations', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.dify_conversation_id, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

app.post('/api/conversations', authRequired, (req, res) => {
  const title = (req.body?.title || '').trim() || '新会话';
  const info = db
    .prepare('INSERT INTO conversations (user_id, title) VALUES (?, ?)')
    .run(req.user.id, title);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(conv);
});

app.patch('/api/conversations/:id', authRequired, (req, res) => {
  const title = (req.body?.title || '').trim();
  if (!title) return err(res, 400, 'title 不能为空');
  const conv = db
    .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!conv) return err(res, 404, '会话不存在');
  db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?").run(
    title,
    conv.id
  );
  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(conv.id));
});

// 删除会话：仅删除本地记录（级联删消息），Dify 侧会话保留作日志
function removeConversation(conv) {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
}

app.delete('/api/conversations/:id', authRequired, (req, res) => {
  const conv = db
    .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!conv) return err(res, 404, '会话不存在');
  removeConversation(conv);
  res.json({ ok: true });
});

app.get('/api/conversations/:id/messages', authRequired, (req, res) => {
  const conv = db
    .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!conv) return err(res, 404, '会话不存在');
  const rows = db
    .prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(conv.id);
  res.json(rows);
});

// ---------- 聊天（SSE 流式转发 Dify） ----------
app.post('/api/chat', authRequired, ah(async (req, res) => {
  const { conversation_id, content } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) {
    return err(res, 400, 'content 不能为空');
  }

  // 1. 确定会话：null 则新建（标题取内容前 20 字），否则校验归属
  let conv;
  if (conversation_id == null) {
    const title = content.trim().slice(0, 20) || '新会话';
    const info = db
      .prepare('INSERT INTO conversations (user_id, title) VALUES (?, ?)')
      .run(req.user.id, title);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  } else {
    conv = db
      .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(conversation_id, req.user.id);
    if (!conv) return err(res, 404, '会话不存在');
  }

  // 2. 持久化 user 消息
  const userMsg = db
    .prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)")
    .run(conv.id, content);

  // SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('meta', { conversation_id: conv.id, user_message_id: userMsg.lastInsertRowid });

  // 客户端断连时中止对 Dify 的请求
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  let full = '';
  let difyConvId = conv.dify_conversation_id;
  let difyMsgId = null;
  let failed = false;

  try {
    const resp = await fetch(difyUrl('/chat-messages'), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: content,
          inputs: {},
          response_mode: 'streaming',
        user: difyUser(req.user.id),
        ...(difyConvId ? { conversation_id: difyConvId } : {}),
        }),
      });

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Dify 请求失败 (${resp.status}): ${text.slice(0, 200)}`);
    }

    // 3. 逐 chunk 解析 Dify SSE 流并转发
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of resp.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLines = rawEvent
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim());
        if (!dataLines.length) continue;
        let payload;
        try {
          payload = JSON.parse(dataLines.join('\n'));
        } catch {
          continue; // 忽略无法解析的行（如 ping 等非 JSON 保活）
        }
        switch (payload.event) {
          case 'message':
          case 'agent_message':
            if (payload.answer) {
              full += payload.answer;
              send('chunk', { content: payload.answer });
            }
            if (payload.conversation_id) difyConvId = payload.conversation_id;
            if (payload.id) difyMsgId = payload.id;
            break;
          case 'message_replace':
            if (payload.answer) {
              full = payload.answer;
              send('replace', { content: payload.answer });
            }
            break;
          case 'message_end':
            if (payload.conversation_id) difyConvId = payload.conversation_id;
            break;
          case 'error':
            failed = true;
            send('error', { message: payload.message || 'Dify 返回错误' });
            res.end();
            return;
          default:
            break; // ping 等事件忽略
        }
      }
    }
  } catch (e) {
    if (controller.signal.aborted) {
      // 客户端主动断连，直接结束
      try { res.end(); } catch {}
      return;
    }
    failed = true;
    send('error', { message: e.message || '请求 Dify 失败' });
    res.end();
    return;
  }

  // 4. 流结束：保存 dify_conversation_id、持久化 assistant 完整消息、更新会话时间
  if (!failed && full) {
    const info = db
      .prepare(
        "INSERT INTO messages (conversation_id, role, content, dify_message_id) VALUES (?, 'assistant', ?, ?)"
      )
      .run(conv.id, full, difyMsgId);
    db.prepare(
      "UPDATE conversations SET dify_conversation_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(difyConvId, conv.id);
    send('done', { message_id: info.lastInsertRowid, conversation_id: conv.id });
  } else if (!failed) {
    send('error', { message: '未收到 Dify 回复内容' });
  }
  res.end();
}));

// ---------- 管理员接口 ----------
app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.role, u.created_at,
              (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversation_count
       FROM users u ORDER BY u.id ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return err(res, 400, '用户名和密码不能为空');
  const finalRole = role || 'user';
  if (!['admin', 'user'].includes(finalRole)) return err(res, 400, 'role 只能为 admin 或 user');
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return err(res, 409, '用户名已存在');
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hash, finalRole);
  const user = db
    .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(user);
});

app.patch('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return err(res, 404, '用户不存在');
  const { password, role } = req.body || {};
  if (role && !['admin', 'user'].includes(role)) {
    return err(res, 400, 'role 只能为 admin 或 user');
  }
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(password, 10),
      user.id
    );
  }
  if (role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  }
  res.json(
    db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(user.id)
  );
});

app.delete('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return err(res, 400, '不能删除当前登录的管理员账号');
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) return err(res, 404, '用户不存在');
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true });
});

app.get('/api/admin/conversations', authRequired, adminRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.dify_conversation_id, c.created_at, c.updated_at,
              c.user_id, u.username,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.updated_at DESC, c.id DESC`
    )
    .all();
  res.json(rows);
});

app.get('/api/admin/conversations/:id/messages', authRequired, adminRequired, (req, res) => {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return err(res, 404, '会话不存在');
  const rows = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC')
    .all(conv.id);
  res.json(rows);
});

app.delete('/api/admin/conversations/:id', authRequired, adminRequired, (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return err(res, 404, '会话不存在');
  removeConversation(conv);
  res.json({ ok: true });
});

// ---------- 生产模式：托管前端构建产物 ----------
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // 非 /api 路由兜底返回 index.html（前端路由）
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((e, req, res, next) => {
  console.error('[error]', e);
  if (res.headersSent) return;
  err(res, 500, '服务器内部错误');
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] 已启动: http://localhost:${PORT}`);
});
