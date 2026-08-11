export interface Loan {
  id: string
  bankName: string
  openDate: string
  disbursementAmount: number
  interestRatePerYear: number
  durationMonths: number
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
}
