import type { MonthlyCloseSummary } from '../types'

// An unclosed month with no cash-flow activity or budget has nothing to review.
// A saved close, incomplete conversion, blocker, or activity must still surface.
export function isEmptyUnclosedMonth(close: MonthlyCloseSummary): boolean {
  const current = close.current
  return close.status === 'ready_to_close' && close.latestSnapshot === null && close.blockers.length === 0
    && current.conversionComplete && !current.hasBudget
    && current.manualTransactionCount === 0 && current.scheduledIncomeCount === 0
    && current.fixedExpenseCount === 0 && current.loanPaymentCount === 0
    && current.incomeTotal === 0 && current.expenseTotal === 0
}
