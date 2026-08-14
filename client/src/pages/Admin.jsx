import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../api'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { fullTime } from '../utils/time'

function UsersTab() {
  const me = useAuth((s) => s.user)
  const show = useToast((s) => s.show)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ username: '', password: '', role: 'user' })
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await request('/admin/users'))
    } catch (e) {
      show(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createUser = async (e) => {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      await request('/admin/users', { method: 'POST', body: form })
      show('用户创建成功', 'success')
      setForm({ username: '', password: '', role: 'user' })
      load()
    } catch (e) {
      show(e.status === 409 ? '用户名已存在' : e.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const resetPassword = async (u) => {
    const pwd = window.prompt(`为用户「${u.username}」设置新密码：`)
    if (!pwd) return
    try {
      await request(`/admin/users/${u.id}`, { method: 'PATCH', body: { password: pwd } })
      show('密码已重置', 'success')
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const changeRole = async (u, role) => {
    try {
      await request(`/admin/users/${u.id}`, { method: 'PATCH', body: { role } })
      show('角色已更新', 'success')
      load()
    } catch (e) {
      show(e.message, 'error')
      load()
    }
  }

  const removeUser = async (u) => {
    if (!window.confirm(`确定删除用户「${u.username}」吗？该用户的会话将一并删除。`)) return
    try {
      await request(`/admin/users/${u.id}`, { method: 'DELETE' })
      show('用户已删除', 'success')
      load()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const inputCls =
    'rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

  return (
    <div>
      <form onSubmit={createUser} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-gray-500">用户名</label>
          <input
            className={inputCls}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">密码</label>
          <input
            type="password"
            className={inputCls}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">角色</label>
          <select
            className={inputCls}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {creating ? '创建中…' : '新建用户'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">用户名</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">会话数</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">加载中…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无用户</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    {u.username}
                    {u.id === me?.id && <span className="ml-1 text-xs text-gray-400">（我）</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.conversation_count}</td>
                  <td className="px-4 py-3 text-gray-500">{fullTime(u.created_at)}</td>
                  <td className="space-x-3 px-4 py-3 text-sm">
                    <button className="text-blue-600 hover:underline" onClick={() => resetPassword(u)}>
                      重置密码
                    </button>
                    <button className="text-red-500 hover:underline" onClick={() => removeUser(u)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MessagesModal({ conv, onClose }) {
  const show = useToast((s) => s.show)
  const [messages, setMessages] = useState(null)

  useEffect(() => {
    request(`/admin/conversations/${conv.id}/messages`)
      .then(setMessages)
      .catch((e) => show(e.message, 'error'))
  }, [conv.id, show])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-800">{conv.title || '未命名会话'}</div>
            <div className="text-xs text-gray-400">所属用户：{conv.username}</div>
          </div>
          <button className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages === null ? (
            <p className="py-8 text-center text-sm text-gray-400">加载中…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">该会话暂无消息</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-left text-sm ${
                    m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ConversationsTab() {
  const show = useToast((s) => s.show)
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      setConvs(await request('/admin/conversations'))
    } catch (e) {
      show(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeConv = async (c) => {
    if (!window.confirm(`确定删除会话「${c.title}」吗？`)) return
    try {
      await request(`/admin/conversations/${c.id}`, { method: 'DELETE' })
      show('会话已删除', 'success')
      load()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-4 py-3 font-medium">标题</th>
            <th className="px-4 py-3 font-medium">所属用户</th>
            <th className="px-4 py-3 font-medium">消息数</th>
            <th className="px-4 py-3 font-medium">更新时间</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">加载中…</td></tr>
          ) : convs.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无会话</td></tr>
          ) : (
            convs.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                onClick={() => setViewing(c)}
              >
                <td className="max-w-56 truncate px-4 py-3">{c.title || '未命名会话'}</td>
                <td className="px-4 py-3">{c.username}</td>
                <td className="px-4 py-3">{c.message_count}</td>
                <td className="px-4 py-3 text-gray-500">{fullTime(c.updated_at)}</td>
                <td className="space-x-3 px-4 py-3 text-sm">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewing(c)
                    }}
                  >
                    查看
                  </button>
                  <button
                    className="text-red-500 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeConv(c)
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {viewing && <MessagesModal conv={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState('users')

  return (
    <div className="min-h-full bg-gray-100">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">后台管理</h1>
          <Link to="/" className="rounded-lg bg-white px-4 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50">
            返回聊天
          </Link>
        </div>
        <div className="mb-4 flex space-x-1 rounded-xl bg-white p-1 shadow-sm">
          {[
            ['users', '用户管理'],
            ['conversations', '会话管理'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'users' ? <UsersTab /> : <ConversationsTab />}
      </div>
    </div>
  )
}
