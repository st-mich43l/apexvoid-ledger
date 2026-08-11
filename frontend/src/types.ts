export interface Loan {
  id: string
  bankName: string
  openDate: string
  disbursementAmount: number
  interestRatePerYear: number
  createdAt: string
  updatedAt: string
  daysElapsed: number
  accruedInterest: number
  currentBalance: number
  monthlyInterest: number
}

export interface LoanInput {
  bankName: string
  openDate: string
  disbursementAmount: number
  interestRatePerYear: number
}
