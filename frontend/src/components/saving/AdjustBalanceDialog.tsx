import { useState } from 'react'
import { ApiError } from '../../api'
import { formatAmountInput, sanitizePositiveAmountInput } from '../../hooks/useTransactionFormState'
import { formatCurrency } from '../../lib/currency'
import { Modal } from '../Modal'
import type { CurrencyCode } from '../../lib/currency'
import type { SavingPot, SavingPotAdjustDirection } from '../../types'

interface AdjustBalanceDialogProps {
  pot: SavingPot
  onClose: () => void
  onAdjust: (amount: number, direction: SavingPotAdjustDirection) => Promise<void>
  initialDirection?: SavingPotAdjustDirection
}

export function AdjustBalanceDialog({
  pot,
  onClose,
  onAdjust,
  initialDirection = 'add',
}: AdjustBalanceDialogProps) {
  const [direction, setDirection] = useState<SavingPotAdjustDirection>(initialDirection)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdjust(value, direction)
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the saving pot.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal label="Adjust saving pot" onClose={onClose} dismissible={!saving}>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Adjust balance</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Current balance: {formatCurrency(pot.balance, pot.currency as CurrencyCode)}. Add or subtract without
            overwriting the total.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 p-1 dark:border-neutral-800">
          <button
            type="button"
            disabled={saving}
            onClick={() => setDirection('add')}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              direction === 'add'
                ? 'bg-emerald-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            Add
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setDirection('subtract')}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              direction === 'subtract'
                ? 'bg-amber-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            Subtract
          </button>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-200">
            Amount ({pot.currency})
          </span>
          <input
            autoFocus
            inputMode="decimal"
            value={formatAmountInput(amount)}
            onChange={(event) => setAmount(sanitizePositiveAmountInput(event.target.value))}
            disabled={saving}
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
            {saving ? 'Saving…' : direction === 'add' ? 'Add to pot' : 'Subtract from pot'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
