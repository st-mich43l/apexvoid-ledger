import type { Loan } from '../types'

export interface MonthlyPaymentSummary {
  activeLoanCount: number
  total: number
  secured: number
  unsecured: number
}

// Per-loan payment formulas stay backend-owned. This helper only aggregates
// the contractual values returned by the API and excludes completed loans.
export function summarizeMonthlyPayments(loans: Loan[]): MonthlyPaymentSummary {
  return loans.reduce<MonthlyPaymentSummary>(
    (summary, loan) => {
      if (loan.isMatured) return summary

      summary.activeLoanCount += 1
      summary.total += loan.monthlyPayment
      summary[loan.loanType] += loan.monthlyPayment
      return summary
    },
    { activeLoanCount: 0, total: 0, secured: 0, unsecured: 0 },
  )
}
