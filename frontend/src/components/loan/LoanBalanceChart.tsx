import { useRef, useState } from 'react'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/currency'
import { formatMonthYear } from '../../lib/date'
import type { LoanScheduleItem } from '../../types'

interface LoanBalanceChartProps {
  schedule: LoanScheduleItem[]
  openDate: string
  disbursementAmount: number
}

const WIDTH = 640
const HEIGHT = 240
const PADDING = { top: 16, right: 16, bottom: 28, left: 16 }
const LINE_COLOR = '#8b5cf6' // violet-500 — validated for light + dark chart surfaces

export function LoanBalanceChart({ schedule, openDate, disbursementAmount }: LoanBalanceChartProps) {
  const { currency } = useCurrency()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (schedule.length === 0) return null

  // A leading "term 0" point (the disbursement itself) gives the line a
  // real starting point instead of jumping straight to term 1's balance.
  const points = [
    { term: 0, dueDate: openDate, balance: disbursementAmount },
    ...schedule.map((item) => ({ term: item.term, dueDate: item.dueDate, balance: item.closingPrincipal })),
  ]

  const maxBalance = Math.max(...points.map((p) => p.balance), 1)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xFor = (i: number) => PADDING.left + (i / (points.length - 1)) * plotWidth
  const yFor = (balance: number) => PADDING.top + plotHeight - (balance / maxBalance) * plotHeight

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.balance)}`).join(' ')
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${PADDING.top + plotHeight} L ${xFor(0)} ${PADDING.top + plotHeight} Z`

  // The first schedule item still "current" or "upcoming" is the next
  // payment due; if every term is completed the loan has matured.
  const currentScheduleIndex = schedule.findIndex((item) => item.status !== 'completed')
  const currentPointIndex = currentScheduleIndex === -1 ? points.length - 1 : currentScheduleIndex + 1

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH
    const fraction = (relativeX - PADDING.left) / plotWidth
    const index = Math.round(fraction * (points.length - 1))
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)))
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null
  const tickIndices = pickTickIndices(points.length)

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Outstanding principal over time</h2>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        Projected across the full loan term, from disbursement to maturity.
      </p>

      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          role="img"
          aria-label="Line chart of outstanding principal declining from disbursement to zero at maturity"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Recessive gridlines at 0%, 50%, 100% of the max balance */}
          {[0, 0.5, 1].map((fraction) => (
            <line
              key={fraction}
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={PADDING.top + plotHeight * (1 - fraction)}
              y2={PADDING.top + plotHeight * (1 - fraction)}
              className="stroke-neutral-100 dark:stroke-neutral-800"
              strokeWidth={1}
            />
          ))}

          <path d={areaPath} fill={LINE_COLOR} fillOpacity={0.08} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current-position marker */}
          <circle
            cx={xFor(currentPointIndex)}
            cy={yFor(points[currentPointIndex].balance)}
            r={4}
            fill={LINE_COLOR}
            stroke="white"
            strokeWidth={2}
            className="dark:stroke-neutral-900"
          />

          {hovered && hoverIndex !== null && (
            <>
              <line
                x1={xFor(hoverIndex)}
                x2={xFor(hoverIndex)}
                y1={PADDING.top}
                y2={PADDING.top + plotHeight}
                className="stroke-neutral-300 dark:stroke-neutral-700"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={xFor(hoverIndex)} cy={yFor(hovered.balance)} r={4} fill={LINE_COLOR} />
            </>
          )}

          {tickIndices.map((i) => (
            <text
              key={i}
              x={xFor(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              className="fill-neutral-400 text-[9px] dark:fill-neutral-500"
            >
              {points[i].term === 0 ? 'Start' : formatMonthYear(points[i].dueDate)}
            </text>
          ))}
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs whitespace-nowrap shadow-[0_2px_8px_-2px_rgba(24,16,54,0.12)] dark:border-neutral-700 dark:bg-neutral-800"
            style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%` }}
          >
            <p className="font-medium text-neutral-900 dark:text-neutral-50">
              {hovered.term === 0 ? 'Disbursement' : `Term ${hovered.term}`}
            </p>
            <p className="text-neutral-500 dark:text-neutral-400">{formatMonthYear(hovered.dueDate)}</p>
            <p className="mt-0.5 font-semibold text-violet-600 dark:text-violet-400">
              {formatCurrency(hovered.balance, currency)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function pickTickIndices(count: number): number[] {
  const maxTicks = 6
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i)
  const step = Math.ceil((count - 1) / (maxTicks - 1))
  const indices = []
  for (let i = 0; i < count - 1; i += step) indices.push(i)
  indices.push(count - 1)
  return indices
}
