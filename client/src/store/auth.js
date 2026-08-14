import { create } from 'zustand'
import { request, getToken, setToken } from '../api'

export const useAuth = create((set, get) => ({
  user: null,
  token: getToken(),
  // 有 token 但还没恢复用户信息时处于 loading
  loading: !!getToken(),

  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    setToken(data.token)
    set({ token: data.token, user: data.user, loading: false })
    return data.user
  },

  async fetchMe() {
    if (!getToken()) {
      set({ user: null, token: null, loading: false })
      return
    }
    try {
      const user = await request('/auth/me')
      set({ user, loading: false })
    } catch (e) {
      // 401 时 request 内部已处理跳转；其余错误视为未登录
      if (e.status !== 401) setToken(null)
      set({ user: null, token: null, loading: false })
    }
  },

  logout() {
    setToken(null)
    set({ user: null, token: null, loading: false })
  },
}))
