import type { BankActivity, FinancialAccount, MonthlyBudgetSummary, MonthlyCloseSummary, NetWorthSummary } from '../../types'

export type AttentionTone = 'danger' | 'warning' | 'info'
export interface FinancialAttentionItem {
  id: string
  tone: AttentionTone
  title: string
  detail: string
  to: string
}

export function deriveFinancialAttention({
  budget,
  netWorth,
  accounts,
  activities,
  close,
  unconvertedCurrencies,
}: {
  budget: MonthlyBudgetSummary | null
  netWorth: NetWorthSummary | null
  accounts: FinancialAccount[]
  activities: BankActivity[]
  close: MonthlyCloseSummary | null
  unconvertedCurrencies: string[]
}): FinancialAttentionItem[] {
  const items: FinancialAttentionItem[] = []
  const unhealthyAccounts = accounts.filter((account) => account.balanceStatus === 'stale' || account.balanceStatus === 'unavailable')
  if (budget?.hasBudget && budget.budgetComparisonComplete && budget.plannedVariableBudgetTotal !== null) {
    const planned = budget.plannedVariableBudgetTotal
    const spent = budget.actualVariableExpenseTotal
    if (spent > planned) items.push({ id: 'budget-overrun', tone: 'danger', title: 'Budget limit exceeded', detail: 'Variable spending is above this month’s planned boundary.', to: '/budget' })
    else if (planned > 0 && spent / planned >= 0.8) items.push({ id: 'budget-near-limit', tone: 'warning', title: 'Budget limit approaching', detail: 'Variable spending has reached at least 80% of the monthly plan.', to: '/budget' })
  }
  if (netWorth && !netWorth.valuationComplete) {
    const accountContext = unhealthyAccounts.length > 0 ? ` ${unhealthyAccounts.length} connected balance${unhealthyAccounts.length === 1 ? ' is' : 's are'} stale or unavailable.` : ''
    items.push({ id: 'valuation-incomplete', tone: 'warning', title: 'Net Worth is incomplete', detail: (netWorth.warnings[0] ?? 'One or more assets cannot be included in the current valuation.') + accountContext, to: '/net-worth' })
  }
  if (unhealthyAccounts.length > 0 && (!netWorth || netWorth.valuationComplete)) {
    items.push({ id: 'bank-balance-stale', tone: 'warning', title: `${unhealthyAccounts.length} bank balance${unhealthyAccounts.length === 1 ? '' : 's'} need review`, detail: 'A displayed balance is stale or unavailable and may not reflect the latest position.', to: '/net-worth' })
  }
  const pendingReview = activities.filter((activity) => activity.processingStatus === 'pending_review').length
  if (pendingReview > 0) items.push({ id: 'bank-review', tone: 'info', title: `${pendingReview} bank activit${pendingReview === 1 ? 'y' : 'ies'} awaiting review`, detail: 'Review unclassified SePay activity before relying on the monthly picture.', to: '/cashflow' })
  if (close && ['needs_review', 'blocked', 'ready_to_close'].includes(close.status)) {
    const title = close.status === 'needs_review' ? 'Previous month changed after close' : close.status === 'blocked' ? 'Previous month cannot close yet' : 'Previous month is ready to close'
    items.push({ id: 'monthly-close', tone: close.status === 'blocked' ? 'warning' : 'info', title, detail: close.blockers[0] ?? 'Review the month-end checkpoint and its current status.', to: `/monthly-close?year=${close.year}&month=${close.month}` })
  }
  if (unconvertedCurrencies.length > 0) items.push({ id: 'conversion-incomplete', tone: 'warning', title: 'Some monthly totals are incomplete', detail: `${unconvertedCurrencies.join(', ')} could not be converted and is excluded from affected totals.`, to: '/cashflow' })
  return items
}
