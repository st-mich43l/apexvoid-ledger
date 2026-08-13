import type { CurrencyCode } from './lib/currency'

export type LoanType = 'secured' | 'unsecured'
export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryInput {
  name: string
  type: TransactionType
  icon: string | null
}

export interface LedgerTransaction {
  id: string
  type: TransactionType
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  amount: number
  currency: CurrencyCode
  occurredAt: string
  description: string | null
  source: 'manual'
  createdAt: string
  updatedAt: string
}

export interface TransactionInput {
  type: TransactionType
  categoryId: string
  amount: number
  currency: CurrencyCode
  occurredAt: string
  description: string | null
}

export interface WeeklyExpenseEntryInput {
  categoryId: string
  amount: number
  description: string | null
}

export interface WeeklyExpenseBatchInput {
  weekEnding: string
  currency: CurrencyCode
  entries: WeeklyExpenseEntryInput[]
}

export interface CategorySpendingSummary {
  categoryId: string
  name: string
  icon: string | null
  amount: number
  percent: number
}

export interface CurrencyConversionRate {
  sourceCurrency: CurrencyCode
  targetCurrency: CurrencyCode
  rate: number
  rateDate: string
}

export interface LoanPaymentActivity {
  id: string
  loanId: string
  bankName: string
  term: number
  dueAt: string
  amount: number
  currency: CurrencyCode
  reportingAmount: number | null
  reportingCurrency: CurrencyCode
}

export interface CashFlowMonthlySummary {
  year: number
  month: number
  currency: CurrencyCode
  income: number
  expenses: number
  netCashFlow: number
  savingsRatePercent: number | null
  transactionCount: number
  loanPaymentCount: number
  loanPayments: LoanPaymentActivity[]
  categoryBreakdown: CategorySpendingSummary[]
  convertedCurrencies: CurrencyCode[]
  unconvertedCurrencies: CurrencyCode[]
  conversionRates: CurrencyConversionRate[]
  exchangeRateProvider: string | null
  exchangeRateProviderUrl: string | null
  excludedCurrencies: CurrencyCode[]
}

export interface SavingPotMonthApplication {
  id: string
  year: number
  month: number
  amountApplied: number
  currency: CurrencyCode
  appliedAt: string
}

export type SavingPotEntryType =
  | 'opening'
  | 'manual_add'
  | 'manual_subtract'
  | 'balance_correction'
  | 'month_apply'
  | 'month_reconciliation'
  | 'legacy_baseline'

export interface SavingPotEntry {
  id: string
  entryType: SavingPotEntryType
  amount: number
  currency: CurrencyCode
  year: number | null
  month: number | null
  note: string | null
  createdAt: string
}

export interface SavingPotHistoryPage {
  items: SavingPotEntry[]
  total: number
  limit: number
  offset: number
}

export interface SavingPot {
  id: string
  balance: number
  currency: CurrencyCode
  createdAt: string
  updatedAt: string
  applications: SavingPotMonthApplication[]
  syncWarnings: string[]
}

export interface SavingPotInput {
  balance: number
  currency?: CurrencyCode
  note?: string | null
}

export type SavingPotAdjustDirection = 'add' | 'subtract'

export interface SavingPotAdjustInput {
  amount: number
  direction: SavingPotAdjustDirection
  note?: string | null
}

export interface Loan {
  id: string
  bankName: string
  openDate: string
  disbursementAmount: number
  currency: CurrencyCode
  interestRatePerYear: number
  durationMonths: number
  loanType: LoanType
  createdAt: string
  updatedAt: string
  daysElapsed: number
  daysRemaining: number
  termsElapsed: number
  termsRemaining: number
  isMatured: boolean
  maturityDate: string
  accruedInterest: number
  currentBalance: number
  monthlyPayment: number
}

export interface LoanInput {
  bankName: string
  openDate: string
  disbursementAmount: number
  currency: CurrencyCode
  interestRatePerYear: number
  durationMonths: number
  loanType: LoanType
}

export interface AuthUser {
  id: string
  username: string
  isAdmin: boolean
  mustChangePassword: boolean
  preferredCurrency: string | null
  createdAt: string
}

export type ScheduleStatus = 'completed' | 'current' | 'upcoming'

export interface LoanScheduleItem {
  term: number
  dueDate: string
  openingPrincipal: number
  payment: number
  principal: number
  interest: number
  closingPrincipal: number
  status: ScheduleStatus
}

// Estimated, contractual-schedule-derived state for one loan — the app has
// no payment tracking, so every figure here assumes installments are paid
// exactly on their due date. Self-sufficient (includes the loan's static
// fields too) so this page works on a direct/refreshed navigation without
// depending on the /loan list having already been fetched.
export interface LoanDetail {
  id: string
  bankName: string
  loanType: LoanType
  disbursementAmount: number
  currency: CurrencyCode
  interestRatePerYear: number
  openDate: string
  maturityDate: string
  durationMonths: number
  termsElapsed: number
  termsRemaining: number
  daysRemaining: number
  isMatured: boolean
  currentPrincipal: number
  estimatedOutstandingBalance: number
  monthlyPayment: number
  totalInterest: number
  totalRepayment: number
  principalRepaid: number
  principalRepaidPercent: number
}
