import { useState } from 'react'
import { formatCurrency } from '../lib/currency'
import type { Loan } from '../types'

interface LoanBreakdownChartProps {
  loans: Loan[]
}

// Fixed categorical order, validated together (light + dark chart surfaces)
// via the dataviz skill's colorblindness checker — never reassigned per
// render, so a given slot always maps to the same hue.
const SLICE_COLORS = ['#8b5cf6', '#d97706', '#059669', '#2563eb'] // violet, amber, emerald, blue
const OTHER_COLOR = '#9ca3af' // neutral gray-400 — folded "everything else" bucket, not a hue slot

const SIZE = 200
const RADIUS = 80
const STROKE_WIDTH = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3 // px of visual gap between adjacent slices

interface Slice {
  label: string
  amount: number
  color: string
}

interface BankGroup {
  key: string
  label: string
  amount: number
}

// "Shinhan", "shinhan", "SHINHAN", " Shinhan " all denote the same bank —
// group by a normalized key (trimmed, collapsed whitespace, lowercased) so
// multiple loans at the same bank sum into one slice instead of splitting
// across duplicates.
function normalizeBankKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function groupLoansByBank(loans: Loan[]): BankGroup[] {
  const groups = new Map<string, BankGroup>()
  for (const loan of loans) {
    const key = normalizeBankKey(loan.bankName)
    const existing = groups.get(key)
    if (existing) {
      existing.amount += loan.currentBalance
    } else {
      // First-seen casing is the display name — a reasonable, simple choice
      // when the same bank was typed inconsistently across loans.
      groups.set(key, { key, label: loan.bankName.trim().replace(/\s+/g, ' '), amount: loan.currentBalance })
    }
  }
  return [...groups.values()]
}

export function LoanBreakdownChart({ loans }: LoanBreakdownChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const balancesByCurrency = loans.reduce((groups, loan) => {
    if (loan.currentBalance <= 0) return groups
    groups.set(loan.currency, (groups.get(loan.currency) ?? 0) + loan.currentBalance)
    return groups
  }, new Map<Loan['currency'], number>())

  if (balancesByCurrency.size > 1) {
    return (
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Loan balance by currency</h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Native balances are kept separate so unlike currencies are never added together.</p>
        <dl className="mt-5 space-y-3">
          {[...balancesByCurrency].map(([currency, amount]) => (
            <div key={currency} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/50">
              <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{currency}</dt>
              <dd className="font-semibold text-neutral-900 dark:text-neutral-50">{formatCurrency(amount, currency)}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  const total = loans.reduce((sum, loan) => sum + loan.currentBalance, 0)
  if (loans.length === 0 || total <= 0) return null
  const currency = loans[0].currency

  const grouped = groupLoansByBank(loans).sort((a, b) => b.amount - a.amount)
  const maxSlices = 4
  const top = grouped.slice(0, maxSlices)
  const rest = grouped.slice(maxSlices)

  const slices: Slice[] = top.map((group, i) => ({
    label: group.label,
    amount: group.amount,
    color: SLICE_COLORS[i],
  }))
  if (rest.length > 0) {
    slices.push({
      label: `Other (${rest.length})`,
      amount: rest.reduce((sum, group) => sum + group.amount, 0),
      color: OTHER_COLOR,
    })
  }

  const gapAngle = (GAP / CIRCUMFERENCE) * 360
  const totalGap = gapAngle * slices.length
  const availableCircumference = CIRCUMFERENCE * (1 - totalGap / 360)

  let cumulativeOffset = 0
  const arcs = slices.map((slice) => {
    const fraction = slice.amount / total
    const dash = fraction * availableCircumference
    const arc = { ...slice, fraction, dash, offset: cumulativeOffset }
    cumulativeOffset += dash + GAP
    return arc
  })

  const hovered = hoverIndex !== null ? arcs[hoverIndex] : null

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Loan balance by bank</h2>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        Share of your total outstanding balance across loans.
      </p>

      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={180}
            height={180}
            role="img"
            aria-label={`Donut chart of loan balance by bank. ${arcs
              .map((a) => `${a.label} ${(a.fraction * 100).toFixed(0)}%`)
              .join(', ')}`}
          >
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {arcs.map((arc, i) => (
                <circle
                  key={arc.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                  opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.35}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              {hovered ? hovered.label : 'Total'}
            </p>
            <p className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {formatCurrency(hovered ? hovered.amount : total, currency)}
            </p>
          </div>
        </div>

        <ul className="w-full space-y-2 sm:max-w-xs">
          {arcs.map((arc, i) => (
            <li
              key={arc.label}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: arc.color }} />
                <span className="truncate text-neutral-600 dark:text-neutral-300">{arc.label}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-medium text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(arc.amount, currency)}
                </span>
                <span className="ml-1.5 text-xs text-neutral-400 dark:text-neutral-500">
                  {(arc.fraction * 100).toFixed(0)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
