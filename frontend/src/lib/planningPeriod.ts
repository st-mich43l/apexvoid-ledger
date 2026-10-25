export interface PlanningPeriod { year: number; month: number }

export function planningPeriodFromSearch(searchParams: URLSearchParams, now = new Date()): PlanningPeriod {
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!Number.isInteger(year) || year < 1 || year > 9999) return fallback
  if (!Number.isInteger(month) || month < 1 || month > 12) return fallback
  return { year, month }
}

export function shiftPlanningPeriod({ year, month }: PlanningPeriod, offset: number): PlanningPeriod {
  const next = new Date(year, month - 1 + offset, 1)
  return { year: next.getFullYear(), month: next.getMonth() + 1 }
}

export function planningMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}
