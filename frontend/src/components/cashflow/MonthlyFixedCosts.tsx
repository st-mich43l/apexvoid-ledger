import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary, RecurringExpenseActivity } from '../../types'

interface MonthlyFixedCostsProps {
  summary: CashFlowMonthlySummary | null
  loading: boolean
  monthLabel: string
  onAdd: () => void
  onManage: () => void
}

function ReportingAmount({ item }: { item: RecurringExpenseActivity }) {
  if (item.currency === item.reportingCurrency || item.reportingAmount === null) return null
  return (
    <span className="block text-[11px] font-normal text-neutral-400 dark:text-neutral-500">
      ≈ {formatCurrency(item.reportingAmount, item.reportingCurrency)}
    </span>
  )
}

export function MonthlyFixedCosts({
  summary,
  loading,
  monthLabel,
  onAdd,
  onManage,
}: MonthlyFixedCostsProps) {
  const items = summary?.recurringExpenses ?? []
  const fixedTotal = summary?.fixedExpenseTotal ?? 0
  const committed = summary?.committedExpenseTotal ?? 0
  const currency = summary?.currency

  return (
    <article className="mt-5 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex flex-col gap-3 border-b border-neutral-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-neutral-800">
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Monthly fixed costs</h3>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {monthLabel} · Scheduled obligations are included automatically.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-violet-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            + Add fixed cost
          </button>
          <button
            type="button"
            onClick={onManage}
            className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Manage
          </button>
        </div>
      </div>

      {loading || !summary || !currency ? (
        <p className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Loading fixed costs…</p>
      ) : (
        <>
          <div className="grid gap-4 border-b border-neutral-200/80 px-5 py-3 sm:grid-cols-2 sm:px-6 dark:border-neutral-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Fixed</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatCurrency(fixedTotal, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Committed incl. loans</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatCurrency(committed, currency)}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Variable {formatCurrency(summary.variableExpenseTotal, currency)} · Loans{' '}
                {formatCurrency(summary.loanPaymentTotal, currency)}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-2 sm:px-6">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">No fixed costs this month.</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Add rent, support, subscriptions, or another monthly obligation.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {item.categoryIcon ? `${item.categoryIcon} ` : ''}
                      {item.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.categoryName} · Due day {String(new Date(item.dueAt).getUTCDate()).padStart(2, '0')}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(item.amount, item.currency)}
                    <ReportingAmount item={item} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  )
}
