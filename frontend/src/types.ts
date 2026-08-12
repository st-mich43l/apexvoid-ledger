export type LoanType = 'secured' | 'unsecured'

export interface Loan {
  id: string
  bankName: string
  openDate: string
  disbursementAmount: number
  interestRatePerYear: number
  durationMonths: number
  loanType: LoanType
  createdAt: string
  updatedAt: string
  daysElapsed: number
  daysRemaining: number
  isMatured: boolean
  maturityDate: string
  accruedInterest: number
  currentBalance: number
  monthlyInterest: number
}

export interface LoanInput {
  bankName: string
  openDate: string
  disbursementAmount: number
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
