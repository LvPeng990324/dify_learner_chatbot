import { create } from 'zustand'
import { request, streamChat } from '../api'

const STREAMING_ID = 'streaming'

export const useChat = create((set, get) => ({
  conversations: [],
  loadingConversations: false,
  activeId: null, // null 表示「新会话」
  messages: [],
  loadingMessages: false,
  streaming: false,
  streamError: null,

  async loadConversations(selectFirst = false) {
    set({ loadingConversations: true })
    try {
      const list = await request('/conversations')
      set({ conversations: list })
      if (selectFirst && get().activeId === null && list.length > 0) {
        await get().selectConversation(list[0].id)
      }
      // 没有选中任何会话（停留在「新会话」页）时加载开场白
      if (get().activeId === null) get().loadOpening()
    } finally {
      set({ loadingConversations: false })
    }
  },

  // 拉取 Dify 开场白，作为新会话的第一条本地 assistant 消息（不落库）
  async loadOpening() {
    try {
      const data = await request('/parameters')
      const content = (data?.opening_statement || '').trim()
      if (!content) return
      // 仅在仍处于新会话且消息为空时展示，避免覆盖用户中途的操作
      if (get().activeId === null && get().messages.length === 0) {
        set({
          messages: [
            { id: 'opening', role: 'assistant', content, created_at: new Date().toISOString() },
          ],
        })
      }
    } catch {
      /* 开场白加载失败静默降级为空状态页 */
    }
  },

  async selectConversation(id) {
    if (get().streaming) return // 生成中不允许切换，避免流写错会话
    set({ activeId: id, messages: [], loadingMessages: true, streamError: null })
    try {
      const messages = await request(`/conversations/${id}/messages`)
      // 切换期间用户可能又点了别的会话
      if (get().activeId === id) set({ messages })
    } finally {
      if (get().activeId === id) set({ loadingMessages: false })
    }
  },

  newConversation() {
    if (get().streaming) return
    set({ activeId: null, messages: [], streamError: null })
    get().loadOpening()
  },

  async renameConversation(id, title) {
    await request(`/conversations/${id}`, { method: 'PATCH', body: { title } })
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }))
  },

  async deleteConversation(id) {
    await request(`/conversations/${id}`, { method: 'DELETE' })
    const wasActive = get().activeId === id
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      ...(wasActive ? { activeId: null, messages: [] } : {}),
    }))
    // 删除当前会话后回到「新会话」页，同样展示开场白
    if (wasActive) get().loadOpening()
  },

  async send(content) {
    const text = content.trim()
    if (!text || get().streaming) return

    const tempUserId = `tmp-user-${Date.now()}`
    set((s) => ({
      streaming: true,
      streamError: null,
      messages: [
        ...s.messages,
        { id: tempUserId, role: 'user', content: text, created_at: new Date().toISOString() },
      ],
    }))

    const appendAssistantChunk = (chunk) => {
      set((s) => {
        const msgs = [...s.messages]
        const last = msgs[msgs.length - 1]
        if (last && last.id === STREAMING_ID) {
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
        } else {
          msgs.push({ id: STREAMING_ID, role: 'assistant', content: chunk, created_at: new Date().toISOString() })
        }
        return { messages: msgs }
      })
    }

    const replaceAssistant = (content) => {
      set((s) => {
        const msgs = [...s.messages]
        const last = msgs[msgs.length - 1]
        if (last && last.id === STREAMING_ID) {
          msgs[msgs.length - 1] = { ...last, content }
        } else {
          msgs.push({ id: STREAMING_ID, role: 'assistant', content, created_at: new Date().toISOString() })
        }
        return { messages: msgs }
      })
    }

    await streamChat(
      { conversation_id: get().activeId, content: text },
      {
        onMeta: ({ conversation_id, user_message_id }) => {
          // 新会话：后端已建好会话，前端切到该会话
          set((s) => ({
            activeId: conversation_id,
            messages: s.messages.map((m) =>
              m.id === tempUserId ? { ...m, id: user_message_id } : m,
            ),
          }))
        },
        onChunk: ({ content }) => appendAssistantChunk(content),
        onReplace: ({ content }) => replaceAssistant(content),
        onDone: async ({ message_id }) => {
          set((s) => ({
            streaming: false,
            messages: s.messages.map((m) => (m.id === STREAMING_ID ? { ...m, id: message_id } : m)),
          }))
          // 刷新会话列表（updated_at / 标题可能变了）
          try {
            const list = await request('/conversations')
            set({ conversations: list })
          } catch {
            /* 列表刷新失败不影响对话 */
          }
        },
        onError: ({ message }) => {
          set((s) => ({
            streaming: false,
            streamError: message || '生成失败，请重试',
            messages: s.messages.filter((m) => m.id !== STREAMING_ID || m.content),
          }))
        },
      },
    ).catch((e) => {
      set((s) => ({
        streaming: false,
        streamError: e.message || '网络错误，请重试',
        messages: s.messages.filter((m) => m.id !== STREAMING_ID || m.content),
      }))
    })
  },
}))
