import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useChat } from '../store/chat'

function Avatar({ variant }) {
  const isAssistant = variant === 'assistant'
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
        isAssistant ? 'bg-white text-gray-500' : 'bg-blue-600 text-white'
      }`}
    >
      {isAssistant ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </div>
  )
}

function AssistantBubble({ content, streaming }) {
  return (
    <div className="flex items-start justify-start gap-2">
      <Avatar variant="assistant" />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm md:max-w-[75%]">
        <div className={`markdown-body text-sm text-gray-800 ${streaming ? 'stream-cursor' : ''}`}>
          {content ? <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown> : (
            <span className="text-gray-400">正在思考…</span>
          )}
        </div>
      </div>
    </div>
  )
}

function UserBubble({ content }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm leading-7 text-white md:max-w-[75%]">
        {content}
      </div>
      <Avatar variant="user" />
    </div>
  )
}

export default function MessageList() {
  const { messages, loadingMessages, activeId, streamError } = useChat()
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages, streamError])

  if (loadingMessages) {
    return <div className="flex flex-1 items-center justify-center text-gray-400">加载消息中…</div>
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-2 text-4xl">💬</div>
          <p className="text-gray-500">{activeId === null ? '开始一个新的会话吧' : '这个会话还没有消息'}</p>
          <p className="mt-1 text-sm text-gray-400">在下方输入你的问题，按 Ctrl+Enter 发送</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-4 md:max-w-5xl xl:max-w-6xl">
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} content={m.content} />
          ) : (
            <AssistantBubble key={m.id} content={m.content} streaming={m.id === 'streaming'} />
          ),
        )}
        {streamError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {streamError}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
