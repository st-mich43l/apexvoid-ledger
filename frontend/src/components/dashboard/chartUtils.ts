import type { CashFlowTrendPoint } from '../../types'

export function cashFlowPointKey(point: Pick<CashFlowTrendPoint, 'year' | 'month'>): string {
  return `${point.year}-${String(point.month).padStart(2, '0')}`
}

export function dashboardMonthLabel(year: number, month: number, short = false): string {
  return new Intl.DateTimeFormat('en-US', {
    month: short ? 'short' : 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
