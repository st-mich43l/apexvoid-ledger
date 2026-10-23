import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary } from '../../types'

export function IncomeExpenseChart({ summary }: { summary: CashFlowMonthlySummary }) {
  const maximum = Math.max(summary.income, summary.expenses, 1)
  const rows = [
    { label: 'Income', amount: summary.income, color: 'bg-emerald-500' },
    { label: 'Expenses', amount: summary.expenses, color: 'bg-violet-500' },
  ]
  const netCashFlow = summary.netCashFlow

  return (
    <article className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Income vs expenses</h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Selected month in {summary.currency}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">Net</p>
          <p className={`mt-0.5 text-sm font-semibold tabular-nums ${netCashFlow < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{netCashFlow > 0 ? '+' : ''}{formatCurrency(netCashFlow, summary.currency)}</p>
        </div>
      </div>
      <div
        className="mt-5 space-y-4"
        role="img"
        aria-label={`Income ${formatCurrency(summary.income, summary.currency)}; expenses ${formatCurrency(summary.expenses, summary.currency)}`}
      >
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{row.label}</span>
              <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{formatCurrency(row.amount, summary.currency)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.amount / maximum) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {summary.income === 0 && (
        <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-950/60 dark:text-neutral-400">No income recorded yet. Add income to calculate a savings rate.</p>
      )}
    </article>
  )
}
