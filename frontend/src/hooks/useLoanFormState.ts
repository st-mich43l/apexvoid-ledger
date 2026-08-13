import { useState, type ChangeEvent } from 'react'
import type { LoanInput, LoanType } from '../types'
import { dateDigitsToIso, isValidDateDigits, isoDateToDigits } from '../lib/date'
import type { CurrencyCode } from '../lib/currency'

export interface LoanFormValues {
  bankName: string
  // dd/mm/yyyy in state; converted to ISO only at the API boundary.
  openDate: string
  // Raw numeric string (no commas) — see formatAmountDisplay below.
  disbursementAmount: string
  currency: CurrencyCode
  interestRatePerYear: string
  durationMonths: string
  loanType: LoanType
}

function emptyValues(currency: CurrencyCode): LoanFormValues {
  return {
    bankName: '',
    openDate: '',
    disbursementAmount: '',
    currency,
    interestRatePerYear: '',
    durationMonths: '12',
    loanType: 'unsecured',
  }
}

export function validateLoanForm(values: LoanFormValues): string | null {
  const bankName = values.bankName.trim()
  if (!bankName) return 'Bank name is required.'
  if (bankName.length > 100) return 'Bank name must be 100 characters or fewer.'

  if (!isValidDateDigits(values.openDate)) return 'Enter a valid open date.'

  const amount = Number(values.disbursementAmount)
  if (!values.disbursementAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
    return 'Disbursement amount must be greater than 0.'
  }

  const interestRate = Number(values.interestRatePerYear)
  if (
    !values.interestRatePerYear.trim() ||
    !Number.isFinite(interestRate) ||
    interestRate < 0 ||
    interestRate > 100
  ) {
    return 'Interest rate must be between 0% and 100%.'
  }

  const duration = Number(values.durationMonths)
  if (
    !values.durationMonths.trim() ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 600
  ) {
    return 'Term must be between 1 and 600 months.'
  }

  if (values.loanType !== 'secured' && values.loanType !== 'unsecured') {
    return 'Select a valid loan type.'
  }

  return null
}

function sanitizeAmountInput(value: string): string {
  let cleaned = value.replace(/,/g, '').replace(/[^\d.-]/g, '')
  const isNegative = cleaned.startsWith('-')
  cleaned = cleaned.replace(/-/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  return isNegative ? `-${cleaned}` : cleaned
}

export function formatAmountDisplay(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

// Converts an existing loan's API fields into editable form state — the
// counterpart to toLoanInput() below, for prepopulating the edit dialog.
export function loanToFormValues(loan: {
  bankName: string
  openDate: string
  disbursementAmount: number
  currency: CurrencyCode
  interestRatePerYear: number
  durationMonths: number
  loanType: LoanType
}): LoanFormValues {
  return {
    bankName: loan.bankName,
    openDate: isoDateToDigits(loan.openDate),
    disbursementAmount: String(loan.disbursementAmount),
    currency: loan.currency,
    interestRatePerYear: String(loan.interestRatePerYear),
    durationMonths: String(loan.durationMonths),
    loanType: loan.loanType,
  }
}

// Shared field state + input handlers for both the create form and the edit
// dialog, so the amount/date formatting logic exists in exactly one place.
export function useLoanFormState(defaultCurrency: CurrencyCode, initial?: LoanFormValues) {
  const [values, setValues] = useState<LoanFormValues>(initial ?? emptyValues(defaultCurrency))

  const handleChange = (field: keyof LoanFormValues) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, disbursementAmount: sanitizeAmountInput(e.target.value) }))
  }

  const handleDateChange = (openDate: string) => {
    setValues((prev) => ({ ...prev, openDate }))
  }

  const handleLoanTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setValues((prev) => ({ ...prev, loanType: e.target.value as LoanType }))
  }

  const handleCurrencyChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setValues((prev) => ({ ...prev, currency: e.target.value as CurrencyCode }))
  }

  function reset() {
    setValues(initial ?? emptyValues(defaultCurrency))
  }

  function toLoanInput(): LoanInput {
    return {
      bankName: values.bankName.trim(),
      openDate: dateDigitsToIso(values.openDate),
      disbursementAmount: Number(values.disbursementAmount),
      currency: values.currency,
      interestRatePerYear: Number(values.interestRatePerYear),
      durationMonths: Number(values.durationMonths),
      loanType: values.loanType,
    }
  }

  function validate(): string | null {
    return validateLoanForm(values)
  }

  return {
    values,
    handleChange,
    handleAmountChange,
    handleDateChange,
    handleLoanTypeChange,
    handleCurrencyChange,
    validate,
    toLoanInput,
    reset,
  }
}
