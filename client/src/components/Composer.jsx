import { useRef, useState } from 'react'
import { useChat } from '../store/chat'

const MAX_HEIGHT = 160

export default function Composer() {
  const [value, setValue] = useState('')
  const { send, streaming } = useChat()
  const taRef = useRef(null)

  const autoGrow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`
  }

  const doSend = async () => {
    const text = value.trim()
    if (!text || streaming) return
    setValue('')
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto'
    })
    await send(text)
  }

  const onKeyDown = (e) => {
    // Enter 发送，Shift+Enter 换行；输入法组词期间不触发
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      doSend()
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 md:px-8">
      <div className="mx-auto flex max-w-3xl items-end space-x-2 md:max-w-5xl xl:max-w-6xl">
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            autoGrow()
          }}
          onKeyDown={onKeyDown}
          placeholder={streaming ? '生成中，请稍候…' : '请描述学生的情况，越具体越好：如年级、学科表现、学习习惯、情绪状态、遇到问题、家庭环境等'}
          disabled={streaming}
          className="max-h-40 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
        />
        {/* 预留：后续可在此追加其他操作按钮 */}
        <button
          onClick={doSend}
          disabled={streaming || !value.trim()}
          className="shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {streaming ? '生成中…' : '发送'}
        </button>
      </div>
    </div>
  )
}
