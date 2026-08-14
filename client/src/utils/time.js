function toDate(value) {
  if (!value) return null
  // 兼容 'YYYY-MM-DD HH:MM:SS' 形式
  const d = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function relTime(value) {
  const d = toDate(value)
  if (!d) return ''
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`
  return d.toLocaleDateString('zh-CN')
}

export function fullTime(value) {
  const d = toDate(value)
  if (!d) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}
