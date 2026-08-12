import { useState } from 'react'
import { ApiError } from '../../api'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import { Modal } from '../Modal'

interface DeletableLoan {
  bankName: string
  disbursementAmount: number
  openDate: string
}

interface DeleteLoanDialogProps {
  loan: DeletableLoan
  onCancel: () => void
  onConfirm: () => Promise<void>
}

// Shared by /loan (list row) and /loan/:loanId (detail page) — both pass
// their own onConfirm (delete-then-refresh-list vs delete-then-navigate).
export function DeleteLoanDialog({ loan, onCancel, onConfirm }: DeleteLoanDialogProps) {
  const { currency } = useCurrency()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete this loan. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <Modal label="Delete loan" onClose={onCancel} dismissible={!deleting}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Delete loan?</h2>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{loan.bankName}</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Disbursed: {formatCurrency(loan.disbursementAmount, currency)}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Opened: {formatDate(loan.openDate)}</p>
      </div>

      <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">This action cannot be undone.</p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={deleting}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
        >
          {deleting ? 'Deleting…' : 'Delete loan'}
        </button>
      </div>
    </Modal>
  )
}
