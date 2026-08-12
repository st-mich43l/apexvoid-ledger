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

export function formatDateDisplay(digits: string): string {
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  return [dd, mm, yyyy].filter(Boolean).join('/')
}

function sanitizeAmountInput(value: string): string {
  let cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  return cleaned
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
      bankName: values.bankName,
      openDate: dateDigitsToIso(values.openDate),
      disbursementAmount: Number(values.disbursementAmount),
      interestRatePerYear: Number(values.interestRatePerYear),
      durationMonths: Number(values.durationMonths),
      loanType: values.loanType,
    }
  }

  return { values, handleChange, handleAmountChange, handleDateChange, handleLoanTypeChange, toLoanInput, reset }
}
