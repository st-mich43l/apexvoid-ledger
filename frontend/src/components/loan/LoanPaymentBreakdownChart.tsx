import { useState } from 'react'
import type { CurrencyCode } from '../../lib/currency'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type { LoanScheduleItem } from '../../types'

interface LoanPaymentBreakdownChartProps {
  schedule: LoanScheduleItem[]
  currency: CurrencyCode
}

const BAR_WIDTH = 6
const GAP = 3
const HEIGHT = 220
const PADDING_TOP = 12
const PADDING_BOTTOM = 24

const PRINCIPAL_COLOR = '#8b5cf6' // violet-500
const INTEREST_COLOR = '#d97706' // amber-600 — both validated together for light + dark

export function LoanPaymentBreakdownChart({ schedule, currency }: LoanPaymentBreakdownChartProps) {
  const [hovered, setHovered] = useState<LoanScheduleItem | null>(null)

  if (schedule.length === 0) return null

  const maxPayment = Math.max(...schedule.map((item) => item.principal + item.interest), 1)
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const width = schedule.length * (BAR_WIDTH + GAP)
  const scaleY = (amount: number) => (amount / maxPayment) * plotHeight

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Principal vs. interest</h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Per installment, across the full term.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRINCIPAL_COLOR }} />
            Principal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INTEREST_COLOR }} />
            Interest
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Stacked bar chart of principal and interest per installment"
          className="max-w-none"
        >
          <line
            x1={0}
            x2={width}
            y1={PADDING_TOP + plotHeight}
            y2={PADDING_TOP + plotHeight}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1}
          />

          {schedule.map((item, i) => {
            const x = i * (BAR_WIDTH + GAP)
            const principalHeight = scaleY(item.principal)
            const interestHeight = scaleY(item.interest)
            const baseY = PADDING_TOP + plotHeight
            const isHovered = hovered?.term === item.term

            return (
              <g
                key={item.term}
                onMouseEnter={() => setHovered(item)}
                onMouseLeave={() => setHovered((current) => (current?.term === item.term ? null : current))}
                className="cursor-pointer"
              >
                <rect x={x} y={baseY - principalHeight} width={BAR_WIDTH} height={principalHeight} fill={PRINCIPAL_COLOR} opacity={isHovered ? 1 : 0.9} />
                <rect
                  x={x}
                  y={baseY - principalHeight - interestHeight - (interestHeight > 0 ? 2 : 0)}
                  width={BAR_WIDTH}
                  height={interestHeight}
                  fill={INTEREST_COLOR}
                  opacity={isHovered ? 1 : 0.9}
                />
                {item.status === 'current' && (
                  <rect x={x} y={PADDING_TOP} width={BAR_WIDTH} height={2} fill="currentColor" className="text-violet-600 dark:text-violet-400" />
                )}
                <title>
                  {`Term ${item.term} · ${formatDate(item.dueDate)}\nPrincipal: ${formatCurrency(item.principal, currency)}\nInterest: ${formatCurrency(item.interest, currency)}`}
                </title>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-2 h-10 text-xs text-neutral-600 dark:text-neutral-300">
        {hovered ? (
          <div className="flex items-center gap-4">
            <span className="font-medium text-neutral-900 dark:text-neutral-50">Term {hovered.term}</span>
            <span>{formatDate(hovered.dueDate)}</span>
            <span style={{ color: PRINCIPAL_COLOR }}>Principal {formatCurrency(hovered.principal, currency)}</span>
            <span style={{ color: INTEREST_COLOR }}>Interest {formatCurrency(hovered.interest, currency)}</span>
          </div>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">Hover a bar for the exact split.</span>
        )}
      </div>
    </div>
  )
}
