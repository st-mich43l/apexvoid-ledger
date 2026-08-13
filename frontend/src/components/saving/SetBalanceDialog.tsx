import { useState } from 'react'
import { ApiError } from '../../api'
import { formatAmountInput, sanitizePositiveAmountInput } from '../../hooks/useTransactionFormState'
import { Modal } from '../Modal'
import type { CurrencyCode } from '../../lib/currency'
import type { SavingPot } from '../../types'

interface SetBalanceDialogProps {
  pot: SavingPot | null
  currency: CurrencyCode
  mode: 'create' | 'correct'
  onClose: () => void
  onSave: (balance: number, note: string | null) => Promise<void>
}

export function SetBalanceDialog({ pot, currency, mode, onClose, onSave }: SetBalanceDialogProps) {
  const [amount, setAmount] = useState(pot ? String(pot.balance) : '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!amount.trim() || !Number.isFinite(value) || value < 0) {
      setError('Enter a balance of zero or more.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(value, note.trim() || null)
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the saving pot.')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'correct' ? 'Correct balance' : 'Create saving pot'
  const description =
    mode === 'correct'
      ? 'Use this when your real savings balance differs from Ledger. The difference will be recorded in activity history.'
      : 'Enter your current available savings. Closed months will add or subtract net cash flow automatically.'

  return (
    <Modal label={title} onClose={onClose} dismissible={!saving}>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-200">Balance ({currency})</span>
          <input
            autoFocus
            inputMode="decimal"
            value={formatAmountInput(amount)}
            onChange={(event) => setAmount(sanitizePositiveAmountInput(event.target.value))}
            disabled={saving}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-200">Note (optional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={saving}
            maxLength={240}
            placeholder={mode === 'correct' ? 'e.g. Bank reconciliation' : 'Optional'}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            {saving ? 'Saving…' : mode === 'correct' ? 'Save correction' : 'Create pot'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
