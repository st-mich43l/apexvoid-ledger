import { useState } from 'react'
import { ApiError } from '../api'
import { useLoanFormState } from '../hooks/useLoanFormState'
import { LoanFormFields } from './loan/LoanFormFields'
import type { LoanInput } from '../types'

interface LoanFormProps {
  onSubmit: (input: LoanInput) => Promise<void>
}

export function LoanForm({ onSubmit }: LoanFormProps) {
  const {
    values,
    handleChange,
    handleAmountChange,
    handleDateChange,
    handleLoanTypeChange,
    validate,
    toLoanInput,
    reset,
  } = useLoanFormState()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(toLoanInput())
      reset()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add loan. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] transition-shadow sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

      <LoanFormFields
        values={values}
        onChange={handleChange}
        onAmountChange={handleAmountChange}
        onDateChange={handleDateChange}
        onLoanTypeChange={handleLoanTypeChange}
        disabled={submitting}
      />

      {error && (
        <p
          role="alert"
          className="relative mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="relative mt-5">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          {submitting ? 'Adding…' : 'Add loan'}
        </button>
      </div>
    </form>
  )
}
