import { useState } from 'react'
import { ApiError } from '../../api'
import { formatCurrency } from '../../lib/currency'
import type { RecurringExpense } from '../../types'
import { Modal } from '../Modal'

function monthLabel(key: string | null): string {
  if (!key) return '—'
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

interface RecurringExpenseManageDialogProps {
  items: RecurringExpense[]
  year: number
  month: number
  onClose: () => void
  onEdit: (expense: RecurringExpense) => void
  onStop: (id: string, effectiveFromMonth: string) => Promise<void>
  onResume: (id: string, resumeFromMonth: string) => Promise<void>
}

export function RecurringExpenseManageDialog({
  items,
  year,
  month,
  onClose,
  onEdit,
  onStop,
  onResume,
}: RecurringExpenseManageDialogProps) {
  const defaultMonth = `${year}-${String(month).padStart(2, '0')}`
  const [pendingStop, setPendingStop] = useState<RecurringExpense | null>(null)
  const [pendingResume, setPendingResume] = useState<RecurringExpense | null>(null)
  const [stopMonth, setStopMonth] = useState(defaultMonth)
  const [resumeMonth, setResumeMonth] = useState(defaultMonth)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmStop() {
    if (!pendingStop) return
    setBusy(true)
    setError(null)
    try {
      await onStop(pendingStop.id, stopMonth)
      setPendingStop(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not stop this fixed cost.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmResume() {
    if (!pendingResume) return
    setBusy(true)
    setError(null)
    try {
      await onResume(pendingResume.id, resumeMonth)
      setPendingResume(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not resume this fixed cost.')
    } finally {
      setBusy(false)
    }
  }

  if (pendingStop) {
    return (
      <Modal label="Stop recurring" onClose={() => !busy && setPendingStop(null)} dismissible={!busy}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Stop {pendingStop.name}</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Earlier months keep this cost. The selected month onward will no longer include it.
        </p>
        <label className="mt-6 block text-sm">
          <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Stop from</span>
          <input
            type="month"
            value={stopMonth}
            onChange={(event) => setStopMonth(event.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setPendingStop(null)} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void confirmStop()} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
            {busy ? 'Stopping…' : 'Stop recurring'}
          </button>
        </div>
      </Modal>
    )
  }

  if (pendingResume) {
    return (
      <Modal label="Resume recurring" onClose={() => !busy && setPendingResume(null)} dismissible={!busy}>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Resume {pendingResume.name}</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Creates a new effective period. Months in the gap stay empty.
        </p>
        <label className="mt-6 block text-sm">
          <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Resume from</span>
          <input
            type="month"
            value={resumeMonth}
            onChange={(event) => setResumeMonth(event.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setPendingResume(null)} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void confirmResume()} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
            {busy ? 'Resuming…' : 'Resume'}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal label="Manage fixed costs" onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Manage fixed costs</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Stop ends the schedule from a month. Resume starts a new period.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          Close
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">No fixed costs configured yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {item.categoryIcon ? `${item.categoryIcon} ` : ''}
                    {item.name}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {item.categoryName} · Due day {String(item.dueDay).padStart(2, '0')} ·{' '}
                    {monthLabel(item.startMonth)}
                    {item.endMonth ? ` → ${monthLabel(item.endMonth)}` : ' → ongoing'}
                  </p>
                  <p className="mt-2 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(item.amount, item.currency)}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      item.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-neutral-200/70 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.isActive && (
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    >
                      Edit
                    </button>
                  )}
                  {item.isActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setStopMonth(defaultMonth)
                        setPendingStop(item)
                      }}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setResumeMonth(defaultMonth)
                        setPendingResume(item)
                      }}
                      className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300"
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
