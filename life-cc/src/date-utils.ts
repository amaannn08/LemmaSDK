const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isISODate(value: string | null | undefined): value is string {
  return Boolean(value && ISO_DATE_RE.test(value))
}

export function getLocalISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalISODate(isoDate: string) {
  if (!isISODate(isoDate)) return null
  const [year, month, day] = isoDate.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function shiftLocalISODate(isoDate: string, deltaDays: number) {
  const parsed = parseLocalISODate(isoDate) ?? new Date()
  parsed.setDate(parsed.getDate() + deltaDays)
  return getLocalISODate(parsed)
}

export function formatDayLabel(isoDate: string) {
  const today = getLocalISODate()
  if (isoDate === today) return 'Today'
  if (isoDate === shiftLocalISODate(today, 1)) return 'Tomorrow'
  if (isoDate === shiftLocalISODate(today, -1)) return 'Yesterday'

  const parsed = parseLocalISODate(isoDate)
  if (!parsed) return isoDate
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(parsed)
}
