import { useToast } from '../store/toast'

export default function Toast() {
  const { message, type } = useToast()
  if (!message) return null
  const color =
    type === 'error'
      ? 'bg-red-600'
      : type === 'success'
        ? 'bg-green-600'
        : 'bg-gray-800'
  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2">
      <div className={`rounded-lg px-4 py-2 text-sm text-white shadow-lg ${color}`}>
        {message}
      </div>
    </div>
  )
}
