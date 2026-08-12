import { useState } from 'react'
import { ApiError } from '../../api'
import { useTransactionFormState } from '../../hooks/useTransactionFormState'
import type { CurrencyCode } from '../../lib/currency'
import type { Category, LedgerTransaction, TransactionInput } from '../../types'
import { Modal } from '../Modal'
import { TransactionFormFields } from './TransactionFormFields'

interface TransactionFormDialogProps {
  currency: CurrencyCode
  categories: Category[]
  transaction?: LedgerTransaction
  onClose: () => void
  onSubmit: (input: TransactionInput) => Promise<void>
}

export function TransactionFormDialog({
  currency,
  categories,
  transaction,
  onClose,
  onSubmit,
}: TransactionFormDialogProps) {
  const form = useTransactionFormState(currency, transaction)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = Boolean(transaction)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const validationError = form.validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      await onSubmit(form.toInput())
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this transaction.')
      setSaving(false)
    }
  }

  return (
    <Modal label={editing ? 'Edit transaction' : 'Add transaction'} onClose={onClose} dismissible={!saving}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {editing ? 'Edit transaction' : 'Add transaction'}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {editing ? 'Update this entry and keep your monthly totals accurate.' : 'Record income or an expense.'}
        </p>

        <div className="mt-6">
          <TransactionFormFields
            values={form.values}
            categories={categories}
            disabled={saving}
            onTypeChange={form.handleTypeChange}
            onCategoryChange={form.handleCategoryChange}
            onAmountChange={form.handleAmountChange}
            onCurrencyChange={form.handleCurrencyChange}
            onDateChange={form.handleDateChange}
            onDescriptionChange={form.handleTextChange('description')}
          />
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
