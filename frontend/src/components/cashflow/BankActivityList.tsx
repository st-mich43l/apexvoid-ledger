import { useMemo, useState } from 'react'
import { ApiError, classifyBankActivity } from '../../api'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type {
  BankActivity,
  BankActivityClassification,
  Category,
} from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { selectClassName } from '../ui/Field'

interface BankActivityListProps {
  activities: BankActivity[]
  categories: Category[]
  loading: boolean
  monthLabel: string
  onChanged: () => Promise<void>
}

const classificationOptions: Array<{ value: BankActivityClassification; label: string }> = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'internal_transfer', label: 'Internal transfer' },
  { value: 'loan_repayment', label: 'Loan repayment' },
  { value: 'loan_interest', label: 'Loan interest' },
  { value: 'savings_transfer', label: 'Savings transfer' },
]

const selectClass = selectClassName

export function BankActivityList({ activities, categories, loading, monthLabel, onChanged }: BankActivityListProps) {
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all')
  const [status, setStatus] = useState<'all' | 'pending_review' | 'processed'>('all')
  const [accountId, setAccountId] = useState('all')

  const accounts = useMemo(() => {
    return [...new Map(activities.map((activity) => [activity.financialAccountId, activity])).values()]
  }, [activities])
  const filtered = activities.filter((activity) => (
    (direction === 'all' || activity.direction === direction) &&
    (status === 'all' || activity.processingStatus === status) &&
    (accountId === 'all' || activity.financialAccountId === accountId)
  ))

  return (
    <Card padding="none" className="h-fit overflow-hidden">
      <div className="border-b border-ledger-border px-5 py-4">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="font-semibold text-ledger-text">Bank activity</h3>
            <p className="mt-1 text-xs text-ledger-text-secondary">
              {activities.length} SePay {activities.length === 1 ? 'event' : 'events'} received in {monthLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter bank activity by direction" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)} className={selectClass}>
              <option value="all">All directions</option>
              <option value="in">Incoming</option>
              <option value="out">Outgoing</option>
            </select>
            <select aria-label="Filter bank activity by status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={selectClass}>
              <option value="all">All statuses</option>
              <option value="pending_review">Needs review</option>
              <option value="processed">Processed</option>
            </select>
            {accounts.length > 1 && (
              <select aria-label="Filter bank activity by account" value={accountId} onChange={(event) => setAccountId(event.target.value)} className={selectClass}>
                <option value="all">All accounts</option>
                {accounts.map((activity) => <option key={activity.financialAccountId} value={activity.financialAccountId ?? ''}>{activity.bankName ?? 'Bank'} · {activity.accountNumberMasked}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="p-5 text-sm text-ledger-text-secondary">Loading bank activity…</p>
      ) : filtered.length === 0 ? (
        <p className="px-5 py-5 text-center text-xs text-ledger-text-secondary">{activities.length === 0 ? `No SePay activity received in ${monthLabel}.` : 'No bank activity matches these filters.'}</p>
      ) : (
        <ul className="divide-y divide-ledger-border">
          {filtered.map((activity) => (
            <BankActivityRow key={activity.id} activity={activity} categories={categories} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function BankActivityRow({ activity, categories, onChanged }: { activity: BankActivity; categories: Category[]; onChanged: () => Promise<void> }) {
  const [classification, setClassification] = useState<BankActivityClassification>(activity.classification)
  const [categoryId, setCategoryId] = useState(activity.categoryId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoryOptions = categories.filter((category) => category.type === (classification === 'income' ? 'income' : 'expense') && category.isActive)
  const needsCategory = classification === 'income' || classification === 'expense' || classification === 'loan_interest'
  const displayAmount = `${activity.direction === 'in' ? '+' : '-'}${formatCurrency(activity.amount, activity.currency)}`

  async function save() {
    if (needsCategory && !categoryId) {
      setError('Select a category.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await classifyBankActivity(activity.id, classification, needsCategory ? categoryId : undefined)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not classify activity.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ledger-text">{activity.description || 'Bank transaction'}</p>
          <p className="mt-1 text-xs text-ledger-text-secondary">{activity.bankName ?? 'Bank'} · {activity.accountNumberMasked} · {formatDate(activity.occurredAt)}</p>
          <p className="mt-1 truncate text-xs text-ledger-muted">{activity.bankReference ? `Ref ${activity.bankReference}` : `SePay #${activity.providerTransactionId}`}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`financial-amount font-semibold ${activity.direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-ledger-text'}`}>{displayAmount}</p>
          <Badge tone={activity.processingStatus === 'pending_review' ? 'warning' : 'success'} className="mt-2">{activity.processingStatus === 'pending_review' ? 'Review' : activity.processingStatus}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <select aria-label={`Classify ${activity.description || 'bank activity'}`} value={classification} onChange={(event) => setClassification(event.target.value as BankActivityClassification)} disabled={saving} className={selectClass}>
          {classificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {needsCategory && <select aria-label="Select bank activity category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={saving} className={selectClass}><option value="">Select category</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}</select>}
        {(classification !== activity.classification || categoryId !== (activity.categoryId ?? '')) && <Button type="button" onClick={() => void save()} loading={saving} size="sm" className="justify-self-start">Save</Button>}
      </div>
      {activity.classification === 'loan_repayment' && (
        <p className="mt-2 text-xs text-ledger-text-secondary">Tracked as a bank activity; it is not added as a Cash Flow transaction.</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">{error}</p>}
    </li>
  )
}
