import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary } from '../../types'

interface CashFlowSummaryCardsProps {
  summary: CashFlowMonthlySummary | null
  loading: boolean
  currency: string
}

export function CashFlowSummaryCards({ summary, loading, currency }: CashFlowSummaryCardsProps) {
  const cards = [
    {
      label: 'Income',
      value: summary ? formatCurrency(summary.income, currency) : '—',
      tone: 'text-emerald-600 dark:text-emerald-400',
      detail: 'Recorded this month',
    },
    {
      label: 'Expenses',
      value: summary ? formatCurrency(summary.expenses, currency) : '—',
      tone: 'text-neutral-900 dark:text-neutral-50',
      detail: 'Recorded this month',
    },
    {
      label: 'Net cash flow',
      value: summary
        ? `${summary.netCashFlow > 0 ? '+' : ''}${formatCurrency(summary.netCashFlow, currency)}`
        : '—',
      tone:
        summary && summary.netCashFlow < 0
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-violet-600 dark:text-violet-400',
      detail: summary?.netCashFlow === undefined ? 'Loading monthly position' : summary.netCashFlow >= 0 ? 'Available after expenses' : 'Spending exceeds income',
    },
    {
      label: 'Savings rate',
      value:
        summary?.savingsRatePercent == null
          ? '—'
          : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(summary.savingsRatePercent)}%`,
      tone: 'text-neutral-900 dark:text-neutral-50',
      detail: summary?.savingsRatePercent == null ? 'Requires recorded income' : 'Of income retained',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="flex min-h-36 flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{card.label}</p>
          <p className={`mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem] ${card.tone}`}>
            {loading ? '…' : card.value}
          </p>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{loading ? 'Refreshing monthly figures…' : card.detail}</p>
        </article>
      ))}
    </div>
  )
}
