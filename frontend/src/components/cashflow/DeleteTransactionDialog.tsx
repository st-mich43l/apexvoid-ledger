import { useState } from 'react'
import { ApiError } from '../../api'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/date'
import type { LedgerTransaction } from '../../types'
import { Modal } from '../Modal'

interface DeleteTransactionDialogProps {
  transaction: LedgerTransaction
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteTransactionDialog({ transaction, onCancel, onConfirm }: DeleteTransactionDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete this transaction.')
      setDeleting(false)
    }
  }

  return (
    <Modal label="Delete transaction" onClose={onCancel} dismissible={!deleting}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Delete transaction?</h2>
      <div className="mt-4 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">
          {transaction.description || transaction.categoryName}
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {transaction.categoryIcon} {transaction.categoryName} · {formatCurrency(transaction.amount, transaction.currency)} · {formatDate(transaction.occurredAt)}
        </p>
      </div>
      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">This action cannot be undone.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-7 flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={deleting} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
        <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete transaction'}</button>
      </div>
    </Modal>
  )
}
