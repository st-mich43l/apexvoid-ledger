import { useState } from 'react'
import { ApiError } from '../../api'
import { Modal } from '../Modal'

interface BudgetResetDialogProps {
  monthLabel: string
  onClose: () => void
  onReset: () => Promise<void>
}

export function BudgetResetDialog({ monthLabel, onClose, onReset }: BudgetResetDialogProps) {
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setResetting(true)
    setError(null)
    try {
      await onReset()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset this spending plan.')
      setResetting(false)
    }
  }

  return (
    <Modal label={`Reset ${monthLabel} spending plan`} onClose={onClose} dismissible={!resetting}>
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Reset spending plan?</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        Planned savings and category allocations for {monthLabel} will be removed. Transactions, Cash Flow, recurring rules, loans, and Saving Pot history stay unchanged.
      </p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">{error}</p>}
      <div className="mt-7 flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={resetting} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
        <button type="button" onClick={handleReset} disabled={resetting} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">{resetting ? 'Resetting…' : 'Reset plan'}</button>
      </div>
    </Modal>
  )
}
