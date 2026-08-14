import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useChat } from '../store/chat'
import { useToast } from '../store/toast'
import { relTime } from '../utils/time'

function ConversationItem({ conv, onAction }) {
  const { activeId, streaming, selectConversation, renameConversation, deleteConversation } = useChat()
  const show = useToast((s) => s.show)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conv.title)
  const active = conv.id === activeId

  const submitRename = async () => {
    const title = draft.trim()
    setEditing(false)
    if (!title || title === conv.title) {
      setDraft(conv.title)
      return
    }
    try {
      await renameConversation(conv.id, title)
    } catch (e) {
      show(e.message, 'error')
      setDraft(conv.title)
    }
  }

  const onDelete = async () => {
    if (!window.confirm(`确定删除会话「${conv.title}」吗？`)) return
    try {
      await deleteConversation(conv.id)
      show('会话已删除', 'success')
    } catch (e) {
      show(e.message, 'error')
    }
  }

  return (
    <div
      className={`group flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm ${
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
      }`}
      onClick={() => {
        if (!editing && !streaming) {
          selectConversation(conv.id)
          onAction?.()
        }
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRename()
            if (e.key === 'Escape') {
              setDraft(conv.title)
              setEditing(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded border border-blue-300 px-1 py-0.5 text-sm outline-none"
        />
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate">{conv.title || '未命名会话'}</div>
            <div className="text-xs text-gray-400">{relTime(conv.updated_at)}</div>
          </div>
          <div className="ml-2 hidden shrink-0 space-x-1 group-hover:flex">
            <button
              title="重命名"
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation()
                setDraft(conv.title)
                setEditing(true)
              }}
            >
              ✎
            </button>
            <button
              title="删除"
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              🗑
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Sidebar({ onAction }) {
  const { user, logout } = useAuth()
  const { conversations, newConversation, streaming } = useChat()

  return (
    <div className="flex h-full w-72 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <div className="mb-3 text-lg font-semibold text-gray-800">学习助手</div>
        <button
          onClick={() => {
            newConversation()
            onAction?.()
          }}
          disabled={streaming}
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          ＋ 新建会话
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">暂无会话，点击上方按钮开始</p>
        )}
        {conversations.map((c) => (
          <ConversationItem key={c.id} conv={c} onAction={onAction} />
        ))}
      </div>

      <div className="border-t border-gray-100 p-3 text-sm">
        <div className="mb-2 flex items-center px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="ml-2 truncate text-gray-700">{user?.username}</span>
        </div>
        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100"
            onClick={onAction}
          >
            后台管理
          </Link>
        )}
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-left text-gray-600 hover:bg-gray-100"
        >
          退出登录
        </button>
      </div>
    </div>
  )
}
