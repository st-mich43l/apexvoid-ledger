import { useState } from 'react'
import { ApiError, updateLoan } from '../../api'
import { loanToFormValues, useLoanFormState } from '../../hooks/useLoanFormState'
import { Modal } from '../Modal'
import { LoanFormFields } from './LoanFormFields'

interface EditableLoan {
  id: string
  bankName: string
  openDate: string
  disbursementAmount: number
  interestRatePerYear: number
  durationMonths: number
  loanType: 'secured' | 'unsecured'
}

interface EditLoanDialogProps {
  loan: EditableLoan
  onClose: () => void
  onSaved: () => void
}

export function EditLoanDialog({ loan, onClose, onSaved }: EditLoanDialogProps) {
  const { values, handleChange, handleAmountChange, handleDateChange, handleLoanTypeChange, toLoanInput } =
    useLoanFormState(loanToFormValues(loan))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateLoan(loan.id, toLoanInput())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Modal label="Edit loan" onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Edit loan</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Update {loan.bankName}'s details.</p>

        <div className="mt-5">
          <LoanFormFields
            values={values}
            onChange={handleChange}
            onAmountChange={handleAmountChange}
            onDateChange={handleDateChange}
            onLoanTypeChange={handleLoanTypeChange}
            disabled={saving}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
