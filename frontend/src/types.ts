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
