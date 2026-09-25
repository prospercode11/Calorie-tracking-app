// Dates are stored as local "YYYY-MM-DD" keys so a day never shifts with time zones.

export type DayKey = string

export function toKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): DayKey {
  return toKey(new Date())
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000)
}

/** Inclusive range of day keys from `start` to `end`. */
export function range(start: DayKey, end: DayKey): DayKey[] {
  const out: DayKey[] = []
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k)
  return out
}

/** First day of the week containing `key`, where weeks begin on `weekStart` (0 = Sun … 6 = Sat). */
export function startOfWeek(key: DayKey, weekStart = 1): DayKey {
  const dow = fromKey(key).getDay()
  return addDays(key, -((dow - weekStart + 7) % 7))
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function weekdayShort(key: DayKey): string {
  return WEEKDAYS[fromKey(key).getDay()]
}

export function weekdayName(dow: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow]
}

export function formatShort(key: DayKey): string {
  const d = fromKey(key)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function formatLong(key: DayKey): string {
  const t = today()
  if (key === t) return 'Today'
  if (key === addDays(t, -1)) return 'Yesterday'
  if (key === addDays(t, 1)) return 'Tomorrow'
  return `${weekdayShort(key)}, ${formatShort(key)}`
}

/** Minutes since midnight → "8:30 AM". */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
