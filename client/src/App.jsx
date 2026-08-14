import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Admin from './pages/Admin'
import Toast from './components/Toast'

function FullPageLoading() {
  return (
    <div className="flex h-full items-center justify-center text-gray-400">加载中…</div>
  )
}

function RequireAuth({ children }) {
  const { user, token, loading } = useAuth()
  if (loading) return <FullPageLoading />
  if (!token || !user) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user, token, loading } = useAuth()
  if (loading) return <FullPageLoading />
  if (!token || !user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { token, user, fetchMe } = useAuth()

  useEffect(() => {
    if (token && !user) fetchMe()
  }, [token, user, fetchMe])

  return (
    <>
      <Toast />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
