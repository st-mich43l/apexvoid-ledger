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
    },
    {
      label: 'Expenses',
      value: summary ? formatCurrency(summary.expenses, currency) : '—',
      tone: 'text-neutral-900 dark:text-neutral-50',
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
    },
    {
      label: 'Savings rate',
      value:
        summary?.savingsRatePercent == null
          ? '—'
          : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(summary.savingsRatePercent)}%`,
      tone: 'text-neutral-900 dark:text-neutral-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{card.label}</p>
          <p className={`mt-2 break-words text-xl font-semibold tracking-tight sm:text-2xl ${card.tone}`}>
            {loading ? '…' : card.value}
          </p>
        </article>
      ))}
    </div>
  )
}
