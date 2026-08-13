import { useState } from 'react'
import { AdjustBalanceDialog } from '../components/saving/AdjustBalanceDialog'
import { SetBalanceDialog } from '../components/saving/SetBalanceDialog'
import { useCurrency } from '../context/CurrencyContext'
import { useSavingPot } from '../hooks/useSavingPot'
import { formatCurrency } from '../lib/currency'
import type { SavingPotAdjustDirection, SavingPotEntry, SavingPotEntryType } from '../types'

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

const ENTRY_TITLES: Record<SavingPotEntryType, string> = {
  opening: 'Opening balance',
  manual_add: 'Manual deposit',
  manual_subtract: 'Manual withdrawal',
  balance_correction: 'Balance correction',
  month_apply: 'Monthly cash flow',
  month_reconciliation: 'Cash flow reconciliation',
  legacy_baseline: 'Legacy balance',
}

function entrySubtitle(entry: SavingPotEntry): string {
  if (entry.note) return entry.note
  if (entry.entryType === 'month_apply' && entry.year != null && entry.month != null) {
    return `${monthLabel(entry.year, entry.month)} cash flow`
  }
  if (entry.entryType === 'month_reconciliation' && entry.year != null && entry.month != null) {
    return `${monthLabel(entry.year, entry.month)} cash flow changed after it was previously applied`
  }
  if (entry.entryType === 'opening') return 'Starting savings when the pot was created'
  if (entry.entryType === 'legacy_baseline') {
    return 'Balance carried forward from before activity tracking'
  }
  return ENTRY_TITLES[entry.entryType]
}

export function SavingPotPage() {
  const { currency } = useCurrency()
  const { pot, history, loading, historyLoading, error, save, adjust } = useSavingPot()
  const [showCreate, setShowCreate] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)
  const [adjustDirection, setAdjustDirection] = useState<SavingPotAdjustDirection | null>(null)

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Saving pot</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Track and understand your available savings.
          </p>
        </div>
        {pot ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAdjustDirection('add')}
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAdjustDirection('subtract')}
              className="rounded-full bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              Subtract
            </button>
            <button
              type="button"
              onClick={() => setShowCorrect(true)}
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Correct balance
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            Create pot
          </button>
        )}
      </div>

      {error && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      {pot && pot.syncWarnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
          <p className="font-medium">Some closed months could not be synchronized</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {pot.syncWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <article className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
          Current balance
        </p>
        <p
          className={`mt-2 break-words text-3xl font-semibold tracking-tight ${
            pot && pot.balance < 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-neutral-900 dark:text-neutral-50'
          }`}
        >
          {loading ? '…' : pot ? formatCurrency(pot.balance, pot.currency) : 'Not set up yet'}
        </p>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {pot
            ? pot.balance < 0
              ? `Currency ${pot.currency}. Negative balance means a savings deficit after cash-flow applications.`
              : `Currency ${pot.currency}. Add, subtract, or correct the balance; closed months sync from cash flow.`
            : 'Create a pot and set your current savings to get started.'}
        </p>
      </article>

      <div className="mt-8">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Recent activity</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Every balance change is recorded here, including monthly cash flow and corrections.
        </p>

        {loading || historyLoading ? (
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : !pot || history.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            No activity yet. Create the pot or wait for a closed month to sync.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {ENTRY_TITLES[entry.entryType]}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-neutral-500 dark:text-neutral-400">
                    {entrySubtitle(entry)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    entry.amount < 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {entry.amount > 0 ? '+' : ''}
                  {formatCurrency(entry.amount, entry.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <SetBalanceDialog
          pot={null}
          currency={currency}
          mode="create"
          onClose={() => setShowCreate(false)}
          onSave={async (balance, note) => {
            await save({ balance, currency, note })
          }}
        />
      )}

      {pot && showCorrect && (
        <SetBalanceDialog
          pot={pot}
          currency={pot.currency}
          mode="correct"
          onClose={() => setShowCorrect(false)}
          onSave={async (balance, note) => {
            await save({ balance, note })
          }}
        />
      )}

      {pot && adjustDirection && (
        <AdjustBalanceDialog
          pot={pot}
          initialDirection={adjustDirection}
          onClose={() => setAdjustDirection(null)}
          onAdjust={async (amount, direction, note) => {
            await adjust({ amount, direction, note })
          }}
        />
      )}
    </section>
  )
}
