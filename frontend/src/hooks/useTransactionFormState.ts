import { useState, type ChangeEvent } from 'react'
import { dateDigitsToIso, isValidDateDigits, isoDateToDigits, todayDateDigits } from '../lib/date'
import type { CurrencyCode } from '../lib/currency'
import type { LedgerTransaction, TransactionInput, TransactionType } from '../types'

export interface TransactionFormValues {
  type: TransactionType
  categoryId: string
  amount: string
  currency: CurrencyCode
  occurredAt: string
  description: string
}

function initialValues(currency: CurrencyCode, transaction?: LedgerTransaction): TransactionFormValues {
  if (transaction) {
    return {
      type: transaction.type,
      categoryId: transaction.categoryId,
      amount: String(transaction.amount),
      currency: transaction.currency,
      occurredAt: isoDateToDigits(transaction.occurredAt),
      description: transaction.description ?? '',
    }
  }
  return {
    type: 'expense',
    categoryId: '',
    amount: '',
    currency,
    occurredAt: todayDateDigits(),
    description: '',
  }
}

export function sanitizePositiveAmountInput(value: string): string {
  const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
}

export function formatAmountInput(raw: string): string {
  if (!raw) return ''
  const [integer, decimal] = raw.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimal === undefined ? grouped : `${grouped}.${decimal}`
}

export function useTransactionFormState(
  currency: CurrencyCode,
  transaction?: LedgerTransaction,
) {
  const [values, setValues] = useState(() => initialValues(currency, transaction))

  const handleTextChange =
    (field: 'description') => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }))
    }

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((current) => ({
      ...current,
      type: event.target.value as TransactionType,
      categoryId: '',
    }))
  }

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((current) => ({ ...current, categoryId: event.target.value }))
  }

  const handleCurrencyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((current) => ({ ...current, currency: event.target.value as CurrencyCode }))
  }

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, amount: sanitizePositiveAmountInput(event.target.value) }))
  }

  const handleDateChange = (occurredAt: string) => {
    setValues((current) => ({ ...current, occurredAt }))
  }

  function validate(): string | null {
    if (!values.categoryId) return 'Select a category.'
    const amount = Number(values.amount)
    if (!values.amount || !Number.isFinite(amount) || amount <= 0) {
      return 'Amount must be greater than 0.'
    }
    if (!isValidDateDigits(values.occurredAt)) return 'Enter a valid transaction date.'
    if (values.description.trim().length > 240) {
      return 'Description must be 240 characters or fewer.'
    }
    return null
  }

  function toInput(): TransactionInput {
    return {
      type: values.type,
      categoryId: values.categoryId,
      amount: Number(values.amount),
      currency: values.currency,
      occurredAt: `${dateDigitsToIso(values.occurredAt)}T12:00:00Z`,
      description: values.description.trim() || null,
    }
  }

  return {
    values,
    handleTextChange,
    handleTypeChange,
    handleCategoryChange,
    handleCurrencyChange,
    handleAmountChange,
    handleDateChange,
    validate,
    toInput,
  }
}
