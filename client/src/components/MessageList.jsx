import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '../store/chat'

function AssistantBubble({ content, streaming }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm md:max-w-[75%]">
        <div className={`markdown-body text-sm text-gray-800 ${streaming ? 'stream-cursor' : ''}`}>
          {content ? <ReactMarkdown>{content}</ReactMarkdown> : (
            <span className="text-gray-400">正在思考…</span>
          )}
        </div>
      </div>
    </div>
  )
}

function UserBubble({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm leading-7 text-white md:max-w-[75%]">
        {content}
      </div>
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
          <p className="mt-1 text-sm text-gray-400">在下方输入你的问题，按 Enter 发送</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
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
