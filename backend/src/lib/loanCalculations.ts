const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface LoanCalculations {
  daysElapsed: number
  accruedInterest: number
  currentBalance: number
  monthlyInterest: number
}

export function calculateLoan(
  disbursementAmount: number,
  interestRatePerYear: number,
  openDate: Date,
): LoanCalculations {
  const now = new Date()
  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - openDate.getTime()) / MS_PER_DAY),
  )

  const dailyRate = interestRatePerYear / 100 / 365
  const accruedInterest = disbursementAmount * dailyRate * daysElapsed
  const currentBalance = disbursementAmount + accruedInterest
  const monthlyInterest = (disbursementAmount * (interestRatePerYear / 100)) / 12

  return {
    daysElapsed,
    accruedInterest: round2(accruedInterest),
    currentBalance: round2(currentBalance),
    monthlyInterest: round2(monthlyInterest),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
