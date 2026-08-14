# dify_learner_chatbot

dify学习力chatflow对接平台。前后端分离架构，用户登录后与自建 Dify 平台上的 chatflow 应用进行流式对话，会话按用户隔离存储，管理员可在后台管理用户与全部会话。

## 技术栈

- 后端 `server/`：Node.js + Express + SQLite（better-sqlite3），JWT 鉴权，SSE 流式代理 Dify API
- 前端 `client/`：React 18 + Vite + TailwindCSS v3 + Zustand + react-router v6 + react-markdown

## 目录结构

```
├── .env                  # 环境变量（不提交，参考 .env.example）
├── server/
│   ├── migrations/       # 版本化 SQL 迁移（001_init.sql ... 递增编号）
│   ├── src/              # 入口 index.js；db.js 内置迁移执行器
│   └── data/app.db       # SQLite 数据文件（自动生成）
└── client/
    └── src/              # 页面：Login / Chat / Admin
```

## 环境变量（根目录 `.env`）

| 变量 | 说明 |
|---|---|
| `API_SERVER_URL` | Dify 服务地址（带不带 `/v1` 后缀均可，后端自动归一化） |
| `API_KEY` | Dify chatflow 应用的 API Key |
| `ADMIN_USER` / `ADMIN_PASSWD` | 首个管理员账号。仅当数据库无任何用户时，启动时自动创建 |
| `JWT_SECRET` | JWT 签名密钥（可选，缺省用开发值，生产必配） |
| `PORT` | 后端端口（可选，默认 3001） |

## 启动

开发模式（两个终端）：

```bash
cd server && npm install && npm start     # 后端 :3001
cd client && npm install && npm run dev   # 前端 :5173，/api 已代理到 3001
```

生产模式（后端直接托管前端构建产物）：

```bash
cd client && npm run build
cd server && npm start                    # 访问 http://localhost:3001
```

## 数据库迁移

`server/migrations/` 下按 `NNN_描述.sql` 递增编号存放迁移文件。库内 `schema_migrations` 表记录已应用版本，服务启动时自动在事务中应用未执行的迁移。修改数据库结构 = 新增一个递增编号的 SQL 文件，不要改动已应用的旧文件。

## 功能说明

- 无注册入口，用户由管理员在后台创建；首次启动用 `.env` 的管理员账号初始化
- 聊天页：左侧会话管理（新建/重命名/删除），中间消息区（Markdown 渲染、流式输出），底部输入区（Enter 发送 / Shift+Enter 换行）；移动端侧栏为抽屉式
- 会话与消息按用户隔离存储于本地 SQLite，同时维护 Dify 侧 `conversation_id` 以保持上下文
- 后台管理（仅 admin）：用户管理（新建/重置密码/改角色/删除）、全站会话管理（查看消息/删除）
