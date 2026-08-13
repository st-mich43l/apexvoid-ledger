import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCompactCurrency, formatCurrency, type CurrencyCode } from '../../lib/currency'
import type { CashFlowTrendPoint } from '../../types'
import { dashboardMonthLabel } from './chartUtils'

interface SpendingMixChartProps {
  point: CashFlowTrendPoint
  allPoints: CashFlowTrendPoint[]
  currency: CurrencyCode
}

const COLORS = ['#8b5cf6', '#d97706', '#059669', '#2563eb', '#db2777', '#0891b2', '#65a30d', '#dc2626']
const OTHER_COLOR = '#9ca3af'
const SIZE = 190
const RADIUS = 72
const STROKE_WIDTH = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

interface Slice {
  id: string
  name: string
  icon: string | null
  amount: number
  percent: number
  color: string
}

export function SpendingMixChart({ point, allPoints, currency }: SpendingMixChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const colorByCategory = useMemo(() => {
    const categories = new Map<string, string>()
    for (const trendPoint of allPoints) {
      for (const item of trendPoint.categoryBreakdown) categories.set(item.categoryId, item.name)
    }
    return new Map(
      [...categories]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id], index) => [id, COLORS[index % COLORS.length]]),
    )
  }, [allPoints])

  const top = point.categoryBreakdown.slice(0, 5)
  const rest = point.categoryBreakdown.slice(5)
  const slices: Slice[] = top.map((item) => ({
    id: item.categoryId,
    name: item.name,
    icon: item.icon,
    amount: item.amount,
    percent: item.percent,
    color: colorByCategory.get(item.categoryId) ?? COLORS[0],
  }))
  if (rest.length > 0) {
    const amount = rest.reduce((sum, item) => sum + item.amount, 0)
    slices.push({
      id: 'other',
      name: `Other (${rest.length})`,
      icon: null,
      amount,
      percent: point.expenses > 0 ? amount / point.expenses * 100 : 0,
      color: OTHER_COLOR,
    })
  }

  const totalGap = (GAP / CIRCUMFERENCE) * 360 * slices.length
  const drawable = CIRCUMFERENCE * (1 - totalGap / 360)
  let cumulativeOffset = 0
  const arcs = slices.map((slice) => {
    const dash = point.expenses > 0 ? slice.amount / point.expenses * drawable : 0
    const arc = { ...slice, dash, offset: cumulativeOffset }
    cumulativeOffset += dash + GAP
    return arc
  })
  const active = arcs.find((slice) => slice.id === activeId)
  const label = dashboardMonthLabel(point.year, point.month)

  return (
    <article className="min-w-0 rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none lg:col-span-2 lg:self-start">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Spending mix</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Where expenses went in {label}</p>
        </div>
        <Link
          to={`/cashflow?year=${point.year}&month=${point.month}`}
          className="shrink-0 text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
        >
          Details →
        </Link>
      </div>

      {arcs.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">No expenses in {label}</p>
          <p className="mt-1 max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
            Record spending or configure monthly commitments to see the category mix.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to={`/cashflow?year=${point.year}&month=${point.month}`} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400">Open Cash Flow</Link>
            <Link to="/monthly-routine" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Monthly Routine</Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
          <div className="relative shrink-0">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              width={180}
              height={180}
              role="img"
              aria-label={`Donut chart of expenses in ${label}. ${arcs.map((slice) => `${slice.name} ${slice.percent.toFixed(0)} percent`).join(', ')}.`}
            >
              <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                {arcs.map((arc) => (
                  <circle
                    key={arc.id}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                    strokeDashoffset={-arc.offset}
                    opacity={activeId === null || activeId === arc.id ? 1 : 0.3}
                    className="transition-opacity"
                  />
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <p className="max-w-24 truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {active?.name ?? 'Expenses'}
              </p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50" title={formatCurrency(active?.amount ?? point.expenses, currency)}>
                {formatCompactCurrency(active?.amount ?? point.expenses, currency)}
              </p>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-1.5" aria-label={`Expense categories for ${label}`}>
            {arcs.map((slice) => (
              <li key={slice.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveId(slice.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(slice.id)}
                  onBlur={() => setActiveId(null)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left outline-none transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-violet-500/30 dark:hover:bg-neutral-800/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
                    <span className="truncate text-sm text-neutral-600 dark:text-neutral-300">
                      {slice.icon && <span aria-hidden="true" className="mr-1.5">{slice.icon}</span>}{slice.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium text-neutral-900 tabular-nums dark:text-neutral-50">{formatCurrency(slice.amount, currency)}</span>
                    <span className="block text-[11px] text-neutral-400 dark:text-neutral-500">{slice.percent.toFixed(slice.percent % 1 ? 1 : 0)}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
