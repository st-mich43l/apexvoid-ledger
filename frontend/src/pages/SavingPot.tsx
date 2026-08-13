import { useState } from 'react'
import { AdjustBalanceDialog } from '../components/saving/AdjustBalanceDialog'
import { SetBalanceDialog } from '../components/saving/SetBalanceDialog'
import { useCurrency } from '../context/CurrencyContext'
import { useSavingPot } from '../hooks/useSavingPot'
import { formatCurrency } from '../lib/currency'
import type { SavingPotAdjustDirection } from '../types'

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

export function SavingPotPage() {
  const { currency } = useCurrency()
  const { pot, loading, error, save, adjust } = useSavingPot()
  const [showCreate, setShowCreate] = useState(false)
  const [adjustDirection, setAdjustDirection] = useState<SavingPotAdjustDirection | null>(null)

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Saving pot</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Track available savings. After each month ends, remaining cash flow is applied once automatically.
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

      <article className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
          Current balance
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {loading ? '…' : pot ? formatCurrency(pot.balance, pot.currency) : 'Not set up yet'}
        </p>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {pot
            ? `Currency ${pot.currency}. Use Add / Subtract to adjust; closed months still auto-apply once.`
            : 'Create a pot and set your current savings to get started.'}
        </p>
      </article>

      <div className="mt-8">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Monthly applications</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Closed months applied from net cash flow (income − expenses).
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : !pot || pot.applications.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            No months applied yet. Applications appear after a month ends.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {pot.applications.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{monthLabel(item.year, item.month)}</p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Auto-applied from monthly net</p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    item.amountApplied < 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {item.amountApplied > 0 ? '+' : ''}
                  {formatCurrency(item.amountApplied, item.currency)}
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
          onClose={() => setShowCreate(false)}
          onSave={async (balance) => {
            await save({ balance, currency })
          }}
        />
      )}

      {pot && adjustDirection && (
        <AdjustBalanceDialog
          pot={pot}
          initialDirection={adjustDirection}
          onClose={() => setAdjustDirection(null)}
          onAdjust={async (amount, direction) => {
            await adjust({ amount, direction })
          }}
        />
      )}
    </section>
  )
}
