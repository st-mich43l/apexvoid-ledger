import { useState, type ChangeEvent } from 'react'
import type { LoanInput, LoanType } from '../types'

export interface LoanFormValues {
  bankName: string
  // ddmmyyyy digits, not ISO — see formatDateDisplay/dateDigitsToIso below.
  openDate: string
  // Raw numeric string (no commas) — see formatAmountDisplay below.
  disbursementAmount: string
  interestRatePerYear: string
  durationMonths: string
  loanType: LoanType
}

const EMPTY_VALUES: LoanFormValues = {
  bankName: '',
  openDate: '',
  disbursementAmount: '',
  interestRatePerYear: '',
  durationMonths: '12',
  loanType: 'unsecured',
}

function isoDateToDigits(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}${m}${y}` : ''
}

function dateDigitsToIso(digits: string): string {
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  return yyyy.length === 4 ? `${yyyy}-${mm}-${dd}` : ''
}

export function isValidDateDigits(digits: string): boolean {
  if (!/^\d{8}$/.test(digits)) return false

  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
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

export function formatDateDisplay(digits: string): string {
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  return [dd, mm, yyyy].filter(Boolean).join('/')
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
  interestRatePerYear: number
  durationMonths: number
  loanType: LoanType
}): LoanFormValues {
  return {
    bankName: loan.bankName,
    openDate: isoDateToDigits(loan.openDate),
    disbursementAmount: String(loan.disbursementAmount),
    interestRatePerYear: String(loan.interestRatePerYear),
    durationMonths: String(loan.durationMonths),
    loanType: loan.loanType,
  }
}

// Shared field state + input handlers for both the create form and the edit
// dialog, so the amount/date formatting logic exists in exactly one place.
export function useLoanFormState(initial?: LoanFormValues) {
  const [values, setValues] = useState<LoanFormValues>(initial ?? EMPTY_VALUES)

  const handleChange = (field: keyof LoanFormValues) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, disbursementAmount: sanitizeAmountInput(e.target.value) }))
  }

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    setValues((prev) => ({ ...prev, openDate: digits }))
  }

  const handleLoanTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setValues((prev) => ({ ...prev, loanType: e.target.value as LoanType }))
  }

  function reset() {
    setValues(initial ?? EMPTY_VALUES)
  }

  function toLoanInput(): LoanInput {
    return {
      bankName: values.bankName.trim(),
      openDate: dateDigitsToIso(values.openDate),
      disbursementAmount: Number(values.disbursementAmount),
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
    validate,
    toLoanInput,
    reset,
  }
}
