import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatCompactCurrency, formatCurrency, type CurrencyCode } from '../../lib/currency'
import type { CashFlowTrendPoint } from '../../types'
import { cashFlowPointKey, dashboardMonthLabel } from './chartUtils'

interface CashFlowTrendChartProps {
  points: CashFlowTrendPoint[]
  currency: CurrencyCode
  selectedKey: string
  onSelect: (point: CashFlowTrendPoint) => void
}

const WIDTH = 720
const HEIGHT = 280
const PADDING = { top: 28, right: 16, bottom: 42, left: 56 }
const INCOME_COLOR = '#10b981'
const EXPENSE_COLOR = '#8b5cf6'

export function CashFlowTrendChart({
  points,
  currency,
  selectedKey,
  onSelect,
}: CashFlowTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selected = points.find((point) => cashFlowPointKey(point) === selectedKey) ?? points.at(-1)
  const selectedIndex = selected ? points.indexOf(selected) : -1
  const maximum = Math.max(...points.flatMap((point) => [point.income, point.expenses]), 1)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const groupWidth = plotWidth / Math.max(points.length, 1)
  const barWidth = Math.min(22, groupWidth * 0.3)
  const barGap = Math.max(3, barWidth * 0.22)
  const xCenter = (index: number) => PADDING.left + groupWidth * (index + 0.5)
  const yFor = (amount: number) => PADDING.top + plotHeight - (amount / maximum) * plotHeight
  const hovered = hoverIndex === null ? null : points[hoverIndex]
  const hasActivity = points.some((point) => point.income > 0 || point.expenses > 0)
  const tooltipLeft = hoverIndex === null
    ? 0
    : (xCenter(hoverIndex) / WIDTH) * (scrollRef.current?.scrollWidth ?? WIDTH)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || selectedIndex < 0 || container.scrollWidth <= container.clientWidth) return
    const pointCenter = container.scrollWidth * ((selectedIndex + 0.5) / points.length)
    container.scrollTo({
      left: Math.max(0, pointCenter - container.clientWidth / 2),
      behavior: 'smooth',
    })
  }, [points.length, selectedIndex])

  function handleKey(event: KeyboardEvent<SVGGElement>, point: CashFlowTrendPoint) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(point)
  }

  return (
    <article className="min-w-0 rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Income vs expenses</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Monthly cash-flow movement in {currency}
          </p>
        </div>
        {selected && (
          <Link
            to={`/cashflow?year=${selected.year}&month=${selected.month}`}
            className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
          >
            View month →
          </Link>
        )}
      </div>

      {selected && (
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-neutral-50 px-4 py-3 dark:bg-neutral-950/60">
          <ChartMetric label="Income" value={formatCurrency(selected.income, currency)} tone="income" />
          <ChartMetric label="Expenses" value={formatCurrency(selected.expenses, currency)} tone="expense" />
          <ChartMetric label="Net" value={formatCurrency(selected.netCashFlow, currency)} tone={selected.netCashFlow >= 0 ? 'income' : 'expense'} />
        </div>
      )}

      <div ref={scrollRef} className="relative mt-4 overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="group"
          aria-label={`Grouped bar chart comparing income and expenses from ${points.length ? dashboardMonthLabel(points[0].year, points[0].month) : 'the selected period'} through ${points.length ? dashboardMonthLabel(points.at(-1)!.year, points.at(-1)!.month) : 'the selected period'}.`}
          className="w-full min-w-[38rem]"
        >
          {[0, 0.5, 1].map((fraction) => {
            const y = PADDING.top + plotHeight * (1 - fraction)
            return (
              <g key={fraction}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  className="stroke-neutral-100 dark:stroke-neutral-800"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-neutral-400 text-[9px] dark:fill-neutral-500"
                >
                  {hasActivity || fraction === 0 ? formatCompactCurrency(maximum * fraction, currency) : ''}
                </text>
              </g>
            )
          })}

          {points.map((point, index) => {
            const center = xCenter(index)
            const incomeHeight = (point.income / maximum) * plotHeight
            const expenseHeight = (point.expenses / maximum) * plotHeight
            const isSelected = cashFlowPointKey(point) === selectedKey
            const label = dashboardMonthLabel(point.year, point.month, true)

            return (
              <g
                key={cashFlowPointKey(point)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${label}. Income ${formatCurrency(point.income, currency)}. Expenses ${formatCurrency(point.expenses, currency)}. Net ${formatCurrency(point.netCashFlow, currency)}. Select month.`}
                onClick={() => onSelect(point)}
                onKeyDown={(event) => handleKey(event, point)}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => {
                  setHoverIndex(index)
                  onSelect(point)
                }}
                onBlur={() => setHoverIndex(null)}
                className="cursor-pointer outline-none"
              >
                {isSelected && (
                  <rect
                    x={PADDING.left + groupWidth * index + 3}
                    y={PADDING.top - 12}
                    width={Math.max(groupWidth - 6, 1)}
                    height={plotHeight + 28}
                    rx={8}
                    className="fill-violet-500/5 stroke-violet-500/30"
                  />
                )}
                <rect
                  x={center - barGap / 2 - barWidth}
                  y={yFor(point.income)}
                  width={barWidth}
                  height={incomeHeight}
                  rx={Math.min(5, barWidth / 3)}
                  fill={INCOME_COLOR}
                />
                <rect
                  x={center + barGap / 2}
                  y={yFor(point.expenses)}
                  width={barWidth}
                  height={expenseHeight}
                  rx={Math.min(5, barWidth / 3)}
                  fill={EXPENSE_COLOR}
                />
                <text
                  x={center}
                  y={HEIGHT - 13}
                  textAnchor="middle"
                  className={isSelected ? 'fill-violet-600 text-[10px] font-semibold dark:fill-violet-400' : 'fill-neutral-400 text-[10px] dark:fill-neutral-500'}
                >
                  {label}
                </text>
              </g>
            )
          })}

          {!hasActivity && (
            <text
              x={PADDING.left + plotWidth / 2}
              y={PADDING.top + plotHeight / 2}
              textAnchor="middle"
              className="fill-neutral-400 text-xs dark:fill-neutral-500"
            >
              No cash-flow activity in this period
            </text>
          )}
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs whitespace-nowrap shadow-md dark:border-neutral-700 dark:bg-neutral-800"
            style={{ left: tooltipLeft }}
          >
            <p className="font-medium text-neutral-900 dark:text-neutral-50">
              {dashboardMonthLabel(hovered.year, hovered.month)}
            </p>
            <p className="mt-1 text-emerald-600 dark:text-emerald-400">Income {formatCurrency(hovered.income, currency)}</p>
            <p className="text-violet-600 dark:text-violet-400">Expenses {formatCurrency(hovered.expenses, currency)}</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />Income</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />Expenses</span>
        <span>Select a month to update both charts.</span>
      </div>

      <div
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        <p>Monthly income, expenses, and net cash flow in {currency}</p>
        <ul>
          {points.map((point) => (
            <li key={cashFlowPointKey(point)}>
              {dashboardMonthLabel(point.year, point.month)}: income {formatCurrency(point.income, currency)}, expenses {formatCurrency(point.expenses, currency)}, net cash flow {formatCurrency(point.netCashFlow, currency)}.
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function ChartMetric({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${tone === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}`} title={value}>{value}</p>
    </div>
  )
}
