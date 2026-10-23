import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary } from '../../types'

export function SpendingByCategory({ summary, monthLabel }: { summary: CashFlowMonthlySummary; monthLabel: string }) {
  return (
    <article className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Spending by category</h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Where expenses went in {monthLabel}</p>

      {summary.categoryBreakdown.length === 0 ? (
        <div className="mt-4 rounded-xl bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500 dark:bg-neutral-950/60 dark:text-neutral-400">
          No expenses recorded for {monthLabel}.
        </div>
      ) : (
        <ul className="mt-5 space-y-3.5" aria-label="Expense categories">
          {summary.categoryBreakdown.map((item) => (
            <li key={item.categoryId}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-neutral-700 dark:text-neutral-300">
                  {item.icon && <span className="mr-2" aria-hidden="true">{item.icon}</span>}{item.name}
                </span>
                <span className="shrink-0 text-right tabular-nums text-xs text-neutral-500 dark:text-neutral-400">
                  {formatCurrency(item.amount, summary.currency)} <span className="text-neutral-400 dark:text-neutral-500">· {item.percent.toFixed(item.percent % 1 ? 1 : 0)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(item.percent, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
