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

export interface RecurringExpenseActivity {
  id: string
  recurringExpenseId: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  dueAt: string
  amount: number
  currency: CurrencyCode
  reportingAmount: number | null
  reportingCurrency: CurrencyCode
}

export interface RecurringExpense {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  amount: number
  currency: CurrencyCode
  dueDay: number
  startMonth: string
  endMonth: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurringExpenseInput {
  name: string
  categoryId: string
  amount: number
  currency: CurrencyCode
  dueDay: number
  startMonth: string
  endMonth?: string | null
}

export interface RecurringExpenseUpdateInput {
  name: string
  categoryId: string
  amount: number
  currency: CurrencyCode
  dueDay: number
  effectiveFromMonth: string
  endMonth?: string | null
}

export interface RecurringIncomeActivity {
  id: string
  recurringIncomeId: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  expectedAt: string
  amount: number
  currency: CurrencyCode
  reportingAmount: number | null
  reportingCurrency: CurrencyCode
}

export interface RecurringIncome {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  amount: number
  currency: CurrencyCode
  expectedDay: number
  startMonth: string
  endMonth: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurringIncomeInput {
  name: string
  categoryId: string
  amount: number
  currency: CurrencyCode
  expectedDay: number
  startMonth: string
  endMonth?: string | null
}

export interface RecurringIncomeUpdateInput {
  name: string
  categoryId: string
  amount: number
  currency: CurrencyCode
  expectedDay: number
  effectiveFromMonth: string
  endMonth?: string | null
}

export interface RoutineVariableCategory {
  categoryId: string
  name: string
  icon: string | null
  amount: number
}

export interface MonthlyRoutineSummary {
  year: number
  month: number
  currency: CurrencyCode
  expectedIncomeTotal: number
  expectedIncomeCount: number
  expectedIncome: RecurringIncomeActivity[]
  fixedExpenseTotal: number
  fixedExpenseCount: number
  fixedExpenses: RecurringExpenseActivity[]
  loanPaymentTotal: number
  loanPaymentCount: number
  loanPayments: LoanPaymentActivity[]
  committedExpenseTotal: number
  baselineAvailable: number
  actualIncomeTotal: number
  actualVariableExpenseTotal: number
  projectedRemainder: number
  variableCategories: RoutineVariableCategory[]
  convertedCurrencies: CurrencyCode[]
  unconvertedCurrencies: CurrencyCode[]
  conversionRates: CurrencyConversionRate[]
  exchangeRateProvider: string | null
  exchangeRateProviderUrl: string | null
}

export interface MonthlyBudgetAllocation {
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  categoryActive: boolean
  allocatedAmount: number
  actualSpent: number
  remainingAmount: number | null
  utilizationPercent: number | null
}

export interface UnbudgetedBudgetCategory {
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  actualSpent: number
}

export interface MonthlyBudgetSummary {
  year: number
  month: number
  hasBudget: boolean
  currency: CurrencyCode
  baselineAvailable: number
  plannedSavingsAmount: number | null
  availableForVariablePlanning: number | null
  plannedVariableBudgetTotal: number | null
  unallocatedBuffer: number | null
  actualVariableExpenseTotal: number
  remainingVariableBudget: number | null
  safeToSpend: number | null
  dailySafeToSpend: number | null
  unbudgetedSpendTotal: number | null
  allocations: MonthlyBudgetAllocation[]
  unbudgetedCategories: UnbudgetedBudgetCategory[]
  budgetComparisonComplete: boolean
  convertedCurrencies: CurrencyCode[]
  unconvertedCurrencies: CurrencyCode[]
  conversionRates: CurrencyConversionRate[]
  exchangeRateProvider: string | null
  exchangeRateProviderUrl: string | null
}

export interface MonthlyBudgetAllocationInput {
  categoryId: string
  amount: number
}

export interface MonthlyBudgetInput {
  currency: CurrencyCode
  plannedSavings: number
  allocations: MonthlyBudgetAllocationInput[]
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
  recurringIncomeTotal: number
  recurringIncomeCount: number
  recurringIncomes: RecurringIncomeActivity[]
  loanPaymentCount: number
  loanPayments: LoanPaymentActivity[]
  fixedExpenseTotal: number
  fixedExpenseCount: number
  variableExpenseTotal: number
  loanPaymentTotal: number
  committedExpenseTotal: number
  recurringExpenses: RecurringExpenseActivity[]
  categoryBreakdown: CategorySpendingSummary[]
  convertedCurrencies: CurrencyCode[]
  unconvertedCurrencies: CurrencyCode[]
  conversionRates: CurrencyConversionRate[]
  exchangeRateProvider: string | null
  exchangeRateProviderUrl: string | null
  excludedCurrencies: CurrencyCode[]
}

export interface CashFlowTrendPoint {
  year: number
  month: number
  income: number
  expenses: number
  netCashFlow: number
  savingsRatePercent: number | null
  categoryBreakdown: CategorySpendingSummary[]
}

export interface CashFlowTrendSummary {
  startYear: number
  startMonth: number
  endYear: number
  endMonth: number
  monthCount: 6 | 12
  currency: CurrencyCode
  points: CashFlowTrendPoint[]
  convertedCurrencies: CurrencyCode[]
  unconvertedCurrencies: CurrencyCode[]
  exchangeRateProvider: string | null
  exchangeRateProviderUrl: string | null
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

export type MonthlyCloseStatus = 'in_progress' | 'ready_to_close' | 'blocked' | 'closed' | 'needs_review'
export type SavingPotCloseStatus =
  | 'not_configured'
  | 'not_applicable'
  | 'missing'
  | 'stale'
  | 'synced'
  | 'blocked'

export interface MonthlyCloseCurrent {
  reportingCurrency: CurrencyCode
  scheduledIncomeTotal: number
  manualIncomeTotal: number
  incomeTotal: number
  fixedExpenseTotal: number
  variableExpenseTotal: number
  loanPaymentTotal: number
  expenseTotal: number
  netCashFlow: number
  manualTransactionCount: number
  scheduledIncomeCount: number
  fixedExpenseCount: number
  loanPaymentCount: number
  hasBudget: boolean
  budgetCurrency: CurrencyCode | null
  plannedSavingsAmount: number | null
  plannedVariableBudgetTotal: number | null
  budgetActualVariableExpenseTotal: number | null
  unallocatedBuffer: number | null
  safeToSpend: number | null
  unbudgetedSpendTotal: number | null
  budgetComparisonComplete: boolean | null
  savingsTargetVariance: number | null
  savingPotExists: boolean
  savingPotApplicable: boolean
  savingPotCurrency: CurrencyCode | null
  savingPotMonthAppliedAmount: number | null
  savingPotSynced: boolean | null
  savingPotStatus: SavingPotCloseStatus
  conversionComplete: boolean
  unconvertedCurrencies: CurrencyCode[]
}

export interface MonthlyCloseSnapshot {
  id: string
  revisionNumber: number
  reportingCurrency: CurrencyCode
  scheduledIncomeTotal: number
  manualIncomeTotal: number
  incomeTotal: number
  fixedExpenseTotal: number
  variableExpenseTotal: number
  loanPaymentTotal: number
  expenseTotal: number
  netCashFlow: number
  manualTransactionCount: number
  scheduledIncomeCount: number
  fixedExpenseCount: number
  loanPaymentCount: number
  hasBudget: boolean
  budgetCurrency: CurrencyCode | null
  plannedSavingsAmount: number | null
  plannedVariableBudgetTotal: number | null
  budgetActualVariableExpenseTotal: number | null
  unallocatedBuffer: number | null
  safeToSpend: number | null
  unbudgetedSpendTotal: number | null
  budgetComparisonComplete: boolean | null
  savingPotExists: boolean
  savingPotApplicable: boolean
  savingPotCurrency: CurrencyCode | null
  savingPotMonthAppliedAmount: number | null
  savingPotSynced: boolean | null
  conversionComplete: boolean
  note: string | null
  closedAt: string
  createdAt: string
}

export interface MonthlyCloseDifference {
  field: string
  label: string
  previousAmount: number | null
  currentAmount: number | null
  currency: CurrencyCode | null
}

export interface MonthlyCloseSummary {
  year: number
  month: number
  status: MonthlyCloseStatus
  closeEligible: boolean
  recloseEligible: boolean
  current: MonthlyCloseCurrent
  latestSnapshot: MonthlyCloseSnapshot | null
  hasDrift: boolean
  driftFields: string[]
  differences: MonthlyCloseDifference[]
  history: MonthlyCloseSnapshot[]
  blockers: string[]
  lastDay: string
}
