import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type {
  LedgerTransaction,
  RecurringExpenseActivity,
  RecurringIncomeActivity,
} from '../../types'

interface TransactionListProps {
  transactions: LedgerTransaction[]
  recurringIncomes: RecurringIncomeActivity[]
  recurringExpenses: RecurringExpenseActivity[]
  loading: boolean
  monthLabel: string
  onAdd: () => void
  onEdit: (transaction: LedgerTransaction) => void
  onDelete: (transaction: LedgerTransaction) => void
}

type MonthlyActivity =
  | { kind: 'transaction'; occurredAt: string; transaction: LedgerTransaction }
  | { kind: 'recurring-income'; occurredAt: string; income: RecurringIncomeActivity }
  | { kind: 'recurring'; occurredAt: string; expense: RecurringExpenseActivity }

function signedAmount(transaction: LedgerTransaction): string {
  const sign = transaction.type === 'income' ? '+' : '-'
  return `${sign}${formatCurrency(transaction.amount, transaction.currency)}`
}

function ActionButtons({
  transaction,
  onEdit,
  onDelete,
}: Pick<TransactionListProps, 'onEdit' | 'onDelete'> & { transaction: LedgerTransaction }) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => onEdit(transaction)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">Edit</button>
      <button type="button" onClick={() => onDelete(transaction)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-950/50 dark:hover:text-red-400">Delete</button>
    </div>
  )
}

function fixedCostAmount(expense: RecurringExpenseActivity): string {
  return `-${formatCurrency(expense.amount, expense.currency)}`
}

function recurringIncomeAmount(income: RecurringIncomeActivity): string {
  return `+${formatCurrency(income.amount, income.currency)}`
}

function FixedReportingAmount({ expense }: { expense: RecurringExpenseActivity }) {
  if (expense.currency === expense.reportingCurrency || expense.reportingAmount === null) return null
  return (
    <span className="block text-[11px] font-normal text-neutral-400 dark:text-neutral-500">
      ≈ {formatCurrency(expense.reportingAmount, expense.reportingCurrency)}
    </span>
  )
}

function IncomeReportingAmount({ income }: { income: RecurringIncomeActivity }) {
  if (income.currency === income.reportingCurrency || income.reportingAmount === null) return null
  return (
    <span className="block text-[11px] font-normal text-neutral-400 dark:text-neutral-500">
      ≈ {formatCurrency(income.reportingAmount, income.reportingCurrency)}
    </span>
  )
}

function FixedCostBadge() {
  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
      Fixed cost
    </span>
  )
}

function ScheduledIncomeBadge() {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      Auto income
    </span>
  )
}

export function TransactionList({
  transactions,
  recurringIncomes,
  recurringExpenses,
  loading,
  monthLabel,
  onAdd,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const activities: MonthlyActivity[] = [
    ...transactions.map((transaction): MonthlyActivity => ({
      kind: 'transaction',
      occurredAt: transaction.occurredAt,
      transaction,
    })),
    ...recurringIncomes.map((income): MonthlyActivity => ({
      kind: 'recurring-income',
      occurredAt: income.expectedAt,
      income,
    })),
    ...recurringExpenses.map((expense): MonthlyActivity => ({
      kind: 'recurring',
      occurredAt: expense.dueAt,
      expense,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  return (
    <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200/80 px-5 py-5 sm:px-6 dark:border-neutral-800">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Monthly activity</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{activities.length} entries in {monthLabel}</p>
        </div>
        <button type="button" onClick={onAdd} className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">Add</button>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Loading transactions…</p>
      ) : activities.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">No transactions yet</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Add your first entry for {monthLabel}.</p>
          <button type="button" onClick={onAdd} className="mt-5 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500">Add transaction</button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950/50 dark:text-neutral-400">
                <tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Description</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {activities.map((activity) => {
                  if (activity.kind === 'recurring-income') {
                    const { income } = activity
                    return (
                      <tr key={income.id} className="bg-emerald-50/40 transition-colors hover:bg-emerald-50/70 dark:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.07]">
                        <td className="whitespace-nowrap px-5 py-4 text-neutral-500 dark:text-neutral-400">{formatDate(income.expectedAt)}</td>
                        <td className="max-w-48 px-5 py-4 font-medium text-neutral-900 dark:text-neutral-100">
                          {income.name}
                          <span className="mt-0.5 block text-xs font-normal text-neutral-400">Mapped from Monthly Routine</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-neutral-600 dark:text-neutral-300">
                          {income.categoryIcon} {income.categoryName}
                        </td>
                        <td className="px-5 py-4"><ScheduledIncomeBadge /></td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                          {recurringIncomeAmount(income)}
                          <IncomeReportingAmount income={income} />
                        </td>
                        <td className="px-3 py-4 text-right">
                          <Link to="/monthly-routine" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">Manage income</Link>
                        </td>
                      </tr>
                    )
                  }
                  if (activity.kind === 'recurring') {
                    const { expense } = activity
                    return (
                      <tr key={expense.id} className="bg-amber-50/40 transition-colors hover:bg-amber-50/70 dark:bg-amber-500/[0.03] dark:hover:bg-amber-500/[0.07]">
                        <td className="whitespace-nowrap px-5 py-4 text-neutral-500 dark:text-neutral-400">{formatDate(expense.dueAt)}</td>
                        <td className="max-w-48 px-5 py-4 font-medium text-neutral-900 dark:text-neutral-100">
                          {expense.name}
                          <span className="mt-0.5 block text-xs font-normal text-neutral-400">Scheduled obligation</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-neutral-600 dark:text-neutral-300">
                          {expense.categoryIcon} {expense.categoryName}
                        </td>
                        <td className="px-5 py-4"><FixedCostBadge /></td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                          {fixedCostAmount(expense)}
                          <FixedReportingAmount expense={expense} />
                        </td>
                        <td className="px-3 py-4 text-right text-xs text-neutral-400">Manage via fixed costs</td>
                      </tr>
                    )
                  }
                  const { transaction } = activity
                  return (
                    <tr key={transaction.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-950/60">
                      <td className="whitespace-nowrap px-5 py-4 text-neutral-500 dark:text-neutral-400">{formatDate(transaction.occurredAt)}</td>
                      <td className="max-w-48 truncate px-5 py-4 font-medium text-neutral-900 dark:text-neutral-100">{transaction.description || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-neutral-600 dark:text-neutral-300">{transaction.categoryIcon} {transaction.categoryName}</td>
                      <td className="px-5 py-4 capitalize text-neutral-500 dark:text-neutral-400">{transaction.type}</td>
                      <td className={`whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{signedAmount(transaction)}</td>
                      <td className="px-3 py-4"><ActionButtons transaction={transaction} onEdit={onEdit} onDelete={onDelete} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-neutral-100 md:hidden dark:divide-neutral-800">
            {activities.map((activity) => {
              if (activity.kind === 'recurring-income') {
                const { income } = activity
                return (
                  <li key={income.id} className="bg-emerald-50/40 p-5 transition-colors hover:bg-emerald-50/70 dark:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.07]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{income.name}</p>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                          {income.categoryIcon} {income.categoryName} · {formatDate(income.expectedAt)}
                        </p>
                        <span className="mt-2 inline-flex"><ScheduledIncomeBadge /></span>
                      </div>
                      <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {recurringIncomeAmount(income)}
                        <IncomeReportingAmount income={income} />
                      </p>
                    </div>
                    <div className="mt-3 text-right"><Link to="/monthly-routine" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">Manage income</Link></div>
                  </li>
                )
              }
              if (activity.kind === 'recurring') {
                const { expense } = activity
                return (
                  <li key={expense.id} className="bg-amber-50/40 p-5 transition-colors hover:bg-amber-50/70 dark:bg-amber-500/[0.03] dark:hover:bg-amber-500/[0.07]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{expense.name}</p>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                          {expense.categoryIcon} {expense.categoryName} · {formatDate(expense.dueAt)}
                        </p>
                        <span className="mt-2 inline-flex"><FixedCostBadge /></span>
                      </div>
                      <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {fixedCostAmount(expense)}
                        <FixedReportingAmount expense={expense} />
                      </p>
                    </div>
                  </li>
                )
              }
              const { transaction } = activity
              return (
                <li key={transaction.id} className="p-5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-950/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{transaction.description || transaction.categoryName}</p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{transaction.categoryIcon} {transaction.categoryName} · {formatDate(transaction.occurredAt)}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{signedAmount(transaction)}</p>
                  </div>
                  <div className="mt-3"><ActionButtons transaction={transaction} onEdit={onEdit} onDelete={onDelete} /></div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </article>
  )
}
