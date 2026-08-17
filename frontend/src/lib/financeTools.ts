export const COMPOUNDING_OPTIONS = [
  { id: 'annually', label: 'Annually', periods: 1 },
  { id: 'semiannually', label: 'Semi-annually', periods: 2 },
  { id: 'quarterly', label: 'Quarterly', periods: 4 },
  { id: 'monthly', label: 'Monthly', periods: 12 },
  { id: 'daily', label: 'Daily', periods: 365 },
] as const

export type CompoundingId = (typeof COMPOUNDING_OPTIONS)[number]['id']
export type LoanCalculatorType = 'unsecured' | 'secured'

export function compoundingPeriods(id: CompoundingId): number {
  return COMPOUNDING_OPTIONS.find((option) => option.id === id)?.periods ?? 12
}

export interface CompoundInterestInput {
  principal: number
  annualRatePercent: number
  years: number
  compoundsPerYear: number
  contributionPerPeriod: number
}

export interface CompoundInterestResult {
  futureValue: number
  interestEarned: number
  contributions: number
  totalDeposit: number
  periods: number
}

export interface LoanPaymentInput {
  disbursementAmount: number
  annualRatePercent: number
  durationMonths: number
  loanType: LoanCalculatorType
  currency?: string
}

export interface LoanPaymentResult {
  monthlyPayment: number
  annualRatePercent: number
  totalRepayment: number
  totalInterest: number
  remainingPrincipal: number
}

const WHOLE_UNIT_CURRENCIES = new Set(['VND', 'JPY'])

function moneyQuantum(currency: string): number {
  return WHOLE_UNIT_CURRENCIES.has(currency) ? 1 : 0.01
}

function roundMoney(value: number, currency: string): number {
  const quantum = moneyQuantum(currency)
  return Math.round(value / quantum) * quantum
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function compoundInterest(input: CompoundInterestInput): CompoundInterestResult | null {
  const { principal, annualRatePercent, years, compoundsPerYear, contributionPerPeriod } = input
  if (!isPositive(principal) || !isPositive(years) || !isPositive(compoundsPerYear)) return null
  if (!Number.isFinite(annualRatePercent) || !isNonNegative(contributionPerPeriod)) return null

  const periods = years * compoundsPerYear
  const ratePerPeriod = annualRatePercent / 100 / compoundsPerYear
  let grownPrincipal: number
  let grownContributions: number

  if (Math.abs(ratePerPeriod) < Number.EPSILON) {
    grownPrincipal = principal
    grownContributions = contributionPerPeriod * periods
  } else {
    const factor = (1 + ratePerPeriod) ** periods
    grownPrincipal = principal * factor
    grownContributions = contributionPerPeriod * ((factor - 1) / ratePerPeriod)
  }

  if (!Number.isFinite(grownPrincipal) || !Number.isFinite(grownContributions)) return null

  const contributions = contributionPerPeriod * periods
  const totalDeposit = principal + contributions
  const futureValue = grownPrincipal + grownContributions
  return {
    futureValue,
    interestEarned: futureValue - totalDeposit,
    contributions,
    totalDeposit,
    periods,
  }
}

function loanEmi(principal: number, monthlyRate: number, durationMonths: number): number {
  if (Math.abs(monthlyRate) < Number.EPSILON) return principal / durationMonths
  const growth = (1 + monthlyRate) ** durationMonths
  return principal * monthlyRate * growth / (growth - 1)
}

export interface CompoundGrowthPoint {
  year: number
  totalDeposit: number
  profitEstimate: number
  resultEstimate: number
}

function growthPoint(year: number, step: CompoundInterestResult): CompoundGrowthPoint {
  return {
    year,
    totalDeposit: step.totalDeposit,
    profitEstimate: step.interestEarned,
    resultEstimate: step.futureValue,
  }
}

export function compoundGrowthSeries(input: CompoundInterestInput): CompoundGrowthPoint[] | null {
  const final = compoundInterest(input)
  if (final === null) return null

  const points: CompoundGrowthPoint[] = [{
    year: 0,
    totalDeposit: input.principal,
    profitEstimate: 0,
    resultEstimate: input.principal,
  }]
  const wholeYears = Math.floor(input.years)
  for (let year = 1; year <= wholeYears; year += 1) {
    const step = compoundInterest({ ...input, years: year })
    if (step === null) return null
    points.push(growthPoint(year, step))
  }
  if (input.years > wholeYears) {
    points.push(growthPoint(input.years, final))
  }
  return points
}

export interface LoanAmortizationPoint {
  term: number
  principal: number
  interest: number
  remaining: number
}

export function loanAmortizationSeries(
  disbursementAmount: number,
  monthlyPayment: number,
  durationMonths: number,
  loanType: LoanCalculatorType,
  annualRatePercent: number,
): LoanAmortizationPoint[] | null {
  if (!isPositive(disbursementAmount) || !isNonNegative(monthlyPayment)) return null
  if (loanType !== 'secured' && !isPositive(monthlyPayment)) return null
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 600) return null
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) return null

  if (loanType === 'secured') {
    return Array.from({ length: durationMonths }, (_, index) => ({
      term: index + 1,
      principal: 0,
      interest: monthlyPayment,
      remaining: disbursementAmount,
    }))
  }

  const monthlyRate = annualRatePercent / 1200
  let remaining = disbursementAmount
  const points: LoanAmortizationPoint[] = []
  for (let term = 1; term <= durationMonths; term += 1) {
    const interest = remaining * monthlyRate
    let principalPay = monthlyPayment - interest
    if (term === durationMonths || principalPay > remaining) {
      principalPay = remaining
    }
    if (principalPay < 0) principalPay = 0
    remaining = Math.max(0, remaining - principalPay)
    points.push({
      term,
      principal: principalPay,
      interest: Math.max(0, interest),
      remaining,
    })
  }
  return points
}

export function loanFromRate(input: LoanPaymentInput): LoanPaymentResult | null {
  const { disbursementAmount, annualRatePercent, durationMonths, loanType, currency = 'VND' } = input
  if (!isPositive(disbursementAmount)) return null
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > 100) return null
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 600) return null

  const monthlyPayment = roundMoney(
    loanType === 'secured'
      ? disbursementAmount * annualRatePercent / 100 / 12
      : loanEmi(disbursementAmount, annualRatePercent / 1200, durationMonths),
    currency,
  )
  if (!Number.isFinite(monthlyPayment) || monthlyPayment < 0) return null

  const schedule = loanAmortizationSeries(
    disbursementAmount,
    monthlyPayment,
    durationMonths,
    loanType,
    annualRatePercent,
  )
  if (schedule === null || schedule.length === 0) return null

  const totalInterest = schedule.reduce((sum, point) => sum + point.interest, 0)
  const totalPrincipal = schedule.reduce((sum, point) => sum + point.principal, 0)
  return {
    monthlyPayment,
    annualRatePercent,
    totalRepayment: totalInterest + totalPrincipal,
    totalInterest,
    remainingPrincipal: schedule.at(-1)?.remaining ?? (loanType === 'secured' ? disbursementAmount : 0),
  }
}
