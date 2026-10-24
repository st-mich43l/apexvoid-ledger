import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type { LedgerTransaction, RecurringExpenseActivity, RecurringIncomeActivity, TransactionType } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { buttonClassName } from '../ui/buttonStyles'
import { Card } from '../ui/Card'
import { controlClassName, selectClassName } from '../ui/Field'

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
type SourceFilter = 'all' | 'manual' | 'sepay' | 'scheduled-income' | 'fixed-cost'

function typeFor(activity: MonthlyActivity): TransactionType { return activity.kind === 'recurring-income' ? 'income' : activity.kind === 'transaction' ? activity.transaction.type : 'expense' }
function sourceFor(activity: MonthlyActivity): Exclude<SourceFilter, 'all'> { return activity.kind === 'transaction' ? activity.transaction.source : activity.kind === 'recurring-income' ? 'scheduled-income' : 'fixed-cost' }
function nameFor(activity: MonthlyActivity): string { return activity.kind === 'transaction' ? activity.transaction.description || activity.transaction.categoryName : activity.kind === 'recurring-income' ? activity.income.name : activity.expense.name }
function categoryFor(activity: MonthlyActivity): string { return activity.kind === 'transaction' ? activity.transaction.categoryName : activity.kind === 'recurring-income' ? activity.income.categoryName : activity.expense.categoryName }
function iconFor(activity: MonthlyActivity): string | null { return activity.kind === 'transaction' ? activity.transaction.categoryIcon : activity.kind === 'recurring-income' ? activity.income.categoryIcon : activity.expense.categoryIcon }
function idFor(activity: MonthlyActivity): string { return activity.kind === 'transaction' ? activity.transaction.id : activity.kind === 'recurring-income' ? activity.income.id : activity.expense.id }

function amountFor(activity: MonthlyActivity): string {
  if (activity.kind === 'transaction') return `${activity.transaction.type === 'income' ? '+' : '-'}${formatCurrency(activity.transaction.amount, activity.transaction.currency)}`
  const item = activity.kind === 'recurring-income' ? activity.income : activity.expense
  return `${activity.kind === 'recurring-income' ? '+' : '-'}${formatCurrency(item.amount, item.currency)}`
}

function reportingAmountFor(activity: MonthlyActivity) {
  if (activity.kind === 'transaction') return null
  const item = activity.kind === 'recurring-income' ? activity.income : activity.expense
  return item.currency === item.reportingCurrency || item.reportingAmount === null ? null : `≈ ${formatCurrency(item.reportingAmount, item.reportingCurrency)}`
}

function SourceBadge({ activity }: { activity: MonthlyActivity }) {
  const source = sourceFor(activity)
  const labels: Record<Exclude<SourceFilter, 'all'>, string> = { manual: 'Manual', sepay: 'SePay', 'scheduled-income': 'Scheduled income', 'fixed-cost': 'Fixed cost' }
  const tones = { manual: 'neutral', sepay: 'info', 'scheduled-income': 'success', 'fixed-cost': 'warning' } as const
  return <Badge tone={tones[source]}>{labels[source]}</Badge>
}

function ActionButtons({ transaction, onEdit, onDelete }: Pick<TransactionListProps, 'onEdit' | 'onDelete'> & { transaction: LedgerTransaction }) {
  return <div className="flex flex-wrap justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => onEdit(transaction)}>Edit</Button><Button type="button" variant="ghost" size="sm" onClick={() => onDelete(transaction)}>Delete</Button></div>
}

function ActivityAmount({ activity }: { activity: MonthlyActivity }) {
  const report = reportingAmountFor(activity)
  return <p className={`financial-amount text-sm font-semibold ${typeFor(activity) === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-ledger-text'}`}>{amountFor(activity)}{report && <span className="mt-0.5 block text-[11px] font-normal text-ledger-text-secondary">{report}</span>}</p>
}

export function TransactionList({ transactions, recurringIncomes, recurringExpenses, loading, monthLabel, onAdd, onEdit, onDelete }: TransactionListProps) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [category, setCategory] = useState('all')
  const [source, setSource] = useState<SourceFilter>('all')
  const activities = useMemo<MonthlyActivity[]>(() => [
    ...transactions.map((transaction): MonthlyActivity => ({ kind: 'transaction', occurredAt: transaction.occurredAt, transaction })),
    ...recurringIncomes.map((income): MonthlyActivity => ({ kind: 'recurring-income', occurredAt: income.expectedAt, income })),
    ...recurringExpenses.map((expense): MonthlyActivity => ({ kind: 'recurring', occurredAt: expense.dueAt, expense })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [transactions, recurringExpenses, recurringIncomes])
  const categories = useMemo(() => [...new Set(activities.map(categoryFor))].sort((a, b) => a.localeCompare(b)), [activities])
  const filtered = activities.filter((activity) => {
    const query = search.trim().toLowerCase()
    return (!query || `${nameFor(activity)} ${categoryFor(activity)}`.toLowerCase().includes(query)) && (type === 'all' || typeFor(activity) === type) && (category === 'all' || categoryFor(activity) === category) && (source === 'all' || sourceFor(activity) === source)
  })
  const hasFilters = Boolean(search || type !== 'all' || category !== 'all' || source !== 'all')
  const resetFilters = () => { setSearch(''); setType('all'); setCategory('all'); setSource('all') }

  return <Card padding="none" className="overflow-hidden">
    <div className="border-b border-ledger-border px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-ledger-text">Monthly activity</h3><p className="mt-1 text-sm text-ledger-text-secondary">{activities.length} entries in {monthLabel}</p></div><Button type="button" variant="ghost" size="sm" onClick={onAdd}>Add</Button></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(13rem,1fr)_auto_auto_auto_auto]">
        <input aria-label="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description or category" className={controlClassName} />
        <select aria-label="Filter activity type" value={type} onChange={(event) => setType(event.target.value as typeof type)} className={selectClassName}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select>
        <select aria-label="Filter activity category" value={category} onChange={(event) => setCategory(event.target.value)} className={selectClassName}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="Filter activity source" value={source} onChange={(event) => setSource(event.target.value as SourceFilter)} className={selectClassName}><option value="all">All sources</option><option value="manual">Manual</option><option value="sepay">SePay</option><option value="scheduled-income">Scheduled income</option><option value="fixed-cost">Fixed cost</option></select>
        {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>}
      </div>
    </div>
    {loading ? <p className="p-6 text-sm text-ledger-text-secondary">Loading transactions…</p> : activities.length === 0 ? <div className="p-10 text-center"><p className="font-medium text-ledger-text">No transactions yet</p><p className="mt-1 text-sm text-ledger-text-secondary">Add your first entry for {monthLabel}.</p><Button type="button" onClick={onAdd} className="mt-5">Add transaction</Button></div> : filtered.length === 0 ? <div className="p-10 text-center"><p className="font-medium text-ledger-text">No activity matches these filters</p><Button type="button" variant="outline" size="sm" onClick={resetFilters} className="mt-4">Clear filters</Button></div> : <>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-ledger-subtle text-xs uppercase tracking-wide text-ledger-text-secondary"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Description</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Source</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-ledger-border">{filtered.map((activity) => <tr key={`${activity.kind}-${idFor(activity)}`} className="hover:bg-ledger-subtle/70"><td className="whitespace-nowrap px-5 py-4 text-ledger-text-secondary">{formatDate(activity.occurredAt)}</td><td className="max-w-xs px-5 py-4"><p className="break-words font-medium text-ledger-text">{nameFor(activity)}</p>{activity.kind !== 'transaction' && <p className="mt-1 text-xs text-ledger-text-secondary">{sourceFor(activity) === 'scheduled-income' ? 'Scheduled from Monthly Routine' : 'Scheduled obligation'}</p>}</td><td className="px-5 py-4 text-ledger-text-secondary">{iconFor(activity)} {categoryFor(activity)}</td><td className="px-5 py-4"><SourceBadge activity={activity} /></td><td className="px-5 py-4 text-right"><ActivityAmount activity={activity} /></td><td className="px-5 py-4">{activity.kind === 'transaction' ? <ActionButtons transaction={activity.transaction} onEdit={onEdit} onDelete={onDelete} /> : activity.kind === 'recurring-income' ? <Link to="/monthly-routine" className={buttonClassName({ variant: 'ghost', size: 'sm' })}>Manage</Link> : null}</td></tr>)}</tbody></table></div>
      <ul className="divide-y divide-ledger-border md:hidden">{filtered.map((activity) => <li key={`${activity.kind}-${idFor(activity)}`} className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium text-ledger-text">{nameFor(activity)}</p><p className="mt-1 text-xs text-ledger-text-secondary">{iconFor(activity)} {categoryFor(activity)} · {formatDate(activity.occurredAt)} · {sourceFor(activity) === 'manual' ? 'Recorded manually' : sourceFor(activity) === 'sepay' ? 'Recorded from SePay' : sourceFor(activity) === 'scheduled-income' ? 'Scheduled from Monthly Routine' : 'Scheduled fixed cost'}</p><span className="mt-2 inline-flex"><SourceBadge activity={activity} /></span></div><div className="shrink-0 text-right"><ActivityAmount activity={activity} /></div></div>{activity.kind === 'transaction' ? <div className="mt-3"><ActionButtons transaction={activity.transaction} onEdit={onEdit} onDelete={onDelete} /></div> : activity.kind === 'recurring-income' ? <div className="mt-3 text-right"><Link to="/monthly-routine" className={buttonClassName({ variant: 'ghost', size: 'sm' })}>Manage income</Link></div> : null}</li>)}</ul>
    </>}
  </Card>
}
