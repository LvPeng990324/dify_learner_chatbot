const TOKEN_KEY = 'token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handle401() {
  setToken(null)
  // 刷新页面，路由守卫会自动跳到登录页
  window.location.href = '/login'
}

export async function request(path, { method = 'GET', body } = {}) {
  const headers = { ...authHeaders() }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    handle401()
    throw new ApiError(401, '登录已过期，请重新登录')
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `请求失败（${res.status}）`)
  return data
}

/**
 * POST /api/chat 的 SSE 流式请求（POST 无法使用 EventSource，手动解析 SSE 帧）。
 * handlers: { onMeta, onChunk, onReplace, onDone, onError }
 */
export async function streamChat({ conversation_id, content }, handlers = {}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ conversation_id, content }),
  })
  if (res.status === 401) {
    handle401()
    throw new ApiError(401, '登录已过期，请重新登录')
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, (data && data.error) || `请求失败（${res.status}）`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let dataLines = []

  const dispatch = () => {
    if (!eventName && dataLines.length === 0) return
    let payload = null
    try {
      payload = JSON.parse(dataLines.join('\n'))
    } catch {
      payload = null
    }
    const h = {
      meta: handlers.onMeta,
      chunk: handlers.onChunk,
      replace: handlers.onReplace,
      done: handlers.onDone,
      error: handlers.onError,
    }[eventName]
    if (h && payload !== null) h(payload)
    eventName = ''
    dataLines = []
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // 最后一行可能不完整，留到下次
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      if (line === '') {
        dispatch()
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
  }
  dispatch()
}
