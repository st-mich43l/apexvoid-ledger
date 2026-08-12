import type { CurrencyCode } from './currency'
import type { Loan } from '../types'

export interface CurrencyMonthlyPaymentSummary {
  currency: CurrencyCode
  total: number
  secured: number
  unsecured: number
}

export interface MonthlyPaymentSummary {
  activeLoanCount: number
  hasActiveSecuredLoan: boolean
  currencies: CurrencyMonthlyPaymentSummary[]
}

// Per-loan payment formulas stay backend-owned. This helper groups the
// contractual values returned by the API without ever adding unlike
// currencies together, and excludes completed loans.
export function summarizeMonthlyPayments(loans: Loan[]): MonthlyPaymentSummary {
  const activeLoans = loans.filter((loan) => !loan.isMatured)
  const grouped = activeLoans.reduce((groups, loan) => {
    const summary = groups.get(loan.currency) ?? {
      currency: loan.currency,
      total: 0,
      secured: 0,
      unsecured: 0,
    }
    summary.total += loan.monthlyPayment
    summary[loan.loanType] += loan.monthlyPayment
    groups.set(loan.currency, summary)
    return groups
  }, new Map<CurrencyCode, CurrencyMonthlyPaymentSummary>())

  return {
    activeLoanCount: activeLoans.length,
    hasActiveSecuredLoan: activeLoans.some((loan) => loan.loanType === 'secured'),
    currencies: [...grouped.values()],
  }
}
