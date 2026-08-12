import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary } from '../../types'

export function IncomeExpenseChart({ summary }: { summary: CashFlowMonthlySummary }) {
  const maximum = Math.max(summary.income, summary.expenses, 1)
  const rows = [
    { label: 'Income', amount: summary.income, color: 'bg-emerald-500' },
    { label: 'Expenses', amount: summary.expenses, color: 'bg-violet-500' },
  ]

  return (
    <article className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div>
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Income vs expenses</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Selected month in {summary.currency}</p>
      </div>
      <div
        className="mt-7 space-y-5"
        role="img"
        aria-label={`Income ${formatCurrency(summary.income, summary.currency)}; expenses ${formatCurrency(summary.expenses, summary.currency)}`}
      >
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{row.label}</span>
              <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{formatCurrency(row.amount, summary.currency)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.amount / maximum) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {summary.income === 0 && (
        <p className="mt-5 text-sm text-neutral-500 dark:text-neutral-400">No income recorded this month.</p>
      )}
    </article>
  )
}
