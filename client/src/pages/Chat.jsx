import { useEffect, useState } from 'react'
import { useChat } from '../store/chat'
import { useToast } from '../store/toast'
import Sidebar from '../components/Sidebar'
import MessageList from '../components/MessageList'
import Composer from '../components/Composer'

export default function Chat() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const loadConversations = useChat((s) => s.loadConversations)
  const conversations = useChat((s) => s.conversations)
  const activeId = useChat((s) => s.activeId)
  const show = useToast((s) => s.show)

  useEffect(() => {
    loadConversations(true).catch((e) => show(e.message, 'error'))
  }, [loadConversations, show])

  const activeTitle =
    activeId === null
      ? '新会话'
      : conversations.find((c) => c.id === activeId)?.title || '会话'

  return (
    <div className="flex h-full overflow-hidden">
      {/* 桌面端常驻侧栏；移动端为抽屉 */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onAction={() => setDrawerOpen(false)} />
      </div>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶栏 */}
        <header className="flex items-center border-b border-gray-200 bg-white px-3 py-2 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="打开会话列表"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <span className="ml-2 truncate text-sm font-medium text-gray-700">{activeTitle}</span>
        </header>

        <MessageList />
        <Composer />
      </div>
    </div>
  )
}
