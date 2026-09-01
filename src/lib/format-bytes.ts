const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  )
  const value = bytes / 1024 ** unitIndex
  const maximumFractionDigits = value < 10 && unitIndex > 0 ? 1 : 0

  return `${new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits,
  }).format(value)} ${BYTE_UNITS[unitIndex]}`
}
