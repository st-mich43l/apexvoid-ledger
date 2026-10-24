import type { BankActivity, CashFlowMonthlySummary, Category } from '../../types'
import { Button } from '../ui/Button'
import { BankActivityList } from './BankActivityList'
import { IncomeExpenseChart } from './IncomeExpenseChart'
import { SpendingByCategory } from './SpendingByCategory'

interface CashFlowInsightsProps {
  summary: CashFlowMonthlySummary | null
  activities: BankActivity[]
  categories: Category[]
  loading: boolean
  monthLabel: string
  onChanged: () => Promise<void>
  onReview: () => void
  onClose?: () => void
}

export function CashFlowInsights({ summary, activities, categories, loading, monthLabel, onChanged, onReview, onClose }: CashFlowInsightsProps) {
  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-ledger-primary">At a glance</p><h2 className="mt-1 text-lg font-semibold text-ledger-text">Insights</h2></div>
      {onClose && <Button type="button" variant="ghost" size="sm" autoFocus onClick={onClose}>Close</Button>}
    </div>
    {summary ? <><IncomeExpenseChart summary={summary} /><SpendingByCategory summary={summary} monthLabel={monthLabel} /></> : <p className="rounded-[var(--ledger-radius-control)] bg-ledger-subtle px-3 py-3 text-sm text-ledger-text-secondary">Monthly insights are unavailable until the summary loads.</p>}
    <BankActivityList activities={activities} categories={categories} loading={loading} monthLabel={monthLabel} onChanged={onChanged} compact onReview={onReview} />
  </div>
}
