import { create } from 'zustand'

let timer = null

export const useToast = create((set) => ({
  message: null,
  type: 'info', // 'info' | 'error' | 'success'
  show(message, type = 'info') {
    if (timer) clearTimeout(timer)
    set({ message, type })
    timer = setTimeout(() => set({ message: null }), 3000)
  },
}))
