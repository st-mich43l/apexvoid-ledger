export const REPORTING_TIME_ZONE = 'Asia/Ho_Chi_Minh'

// dd/mm/yyyy, independent of the visitor's browser/OS locale. SePay records
// Vietnam banking time, so activity cannot move to the prior UTC date.
export function formatDate(iso: string): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: REPORTING_TIME_ZONE,
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  const dd = values.day
  const mm = values.month
  const yyyy = values.year
  return `${dd}/${mm}/${yyyy}`
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function formatMonthYear(iso: string): string {
  const date = new Date(iso)
  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function isoDateToDigits(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return year && month && day ? `${day}${month}${year}` : ''
}

export function dateDigitsToIso(digits: string): string {
  const normalized = digits.replace(/\D/g, '')
  const day = normalized.slice(0, 2)
  const month = normalized.slice(2, 4)
  const year = normalized.slice(4, 8)
  return year.length === 4 ? `${year}-${month}-${day}` : ''
}

export function isValidDateDigits(digits: string): boolean {
  const normalized = digits.replace(/\D/g, '')
  if (!/^\d{8}$/.test(normalized)) return false

  const day = Number(normalized.slice(0, 2))
  const month = Number(normalized.slice(2, 4))
  const year = Number(normalized.slice(4, 8))
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

export function todayDateDigits(): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${day}${month}${now.getFullYear()}`
}

// Dashboard and SePay-backed reporting use the same Vietnam banking calendar.
export function currentReportingPeriod(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    timeZone: REPORTING_TIME_ZONE,
  }).formatToParts(now)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return { year: Number(values.year), month: Number(values.month) }
}

export interface MonthWeekOption {
  value: string
  startDay: number
  endDay: number
  label: string
}

export function monthWeekOptions(year: number, month: number): MonthWeekOption[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const options: MonthWeekOption[] = []
  let startDay = 1

  while (startDay <= lastDay) {
    const start = new Date(Date.UTC(year, month - 1, startDay))
    const daysUntilSunday = (7 - start.getUTCDay()) % 7
    const endDay = Math.min(lastDay, startDay + daysUntilSunday)
    const monthLabel = MONTH_LABELS[month - 1]
    const range = startDay === endDay ? `${startDay} ${monthLabel}` : `${startDay}–${endDay} ${monthLabel}`
    options.push({
      value: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
      startDay,
      endDay,
      label: `Week ${options.length + 1} · ${range}`,
    })
    startDay = endDay + 1
  }

  return options
}

export function defaultMonthWeekValue(
  year: number,
  month: number,
  options: MonthWeekOption[],
  now = new Date(),
): string {
  const selectedMonth = year * 12 + month
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1
  if (selectedMonth < currentMonth) return options.at(-1)?.value ?? ''
  if (selectedMonth > currentMonth) return options[0]?.value ?? ''

  const today = now.getDate()
  return options.find((option) => option.startDay <= today && today <= option.endDay)?.value
    ?? options.at(-1)?.value
    ?? ''
}
