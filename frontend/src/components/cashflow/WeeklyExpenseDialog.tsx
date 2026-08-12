import { useMemo, useState } from 'react'
import { ApiError } from '../../api'
import {
  formatAmountInput,
  sanitizePositiveAmountInput,
} from '../../hooks/useTransactionFormState'
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../lib/currency'
import { defaultMonthWeekValue, monthWeekOptions } from '../../lib/date'
import type { Category, WeeklyExpenseBatchInput } from '../../types'
import { Modal } from '../Modal'

interface WeeklyExpenseDialogProps {
  currency: CurrencyCode
  categories: Category[]
  year: number
  month: number
  monthLabel: string
  onClose: () => void
  onSubmit: (input: WeeklyExpenseBatchInput) => Promise<void>
}

interface ExpenseRow {
  id: number
  categoryId: string
  amount: string
  description: string
}

let nextRowId = 1

function emptyRow(): ExpenseRow {
  return { id: nextRowId++, categoryId: '', amount: '', description: '' }
}

const inputClass =
  'mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'

export function WeeklyExpenseDialog({
  currency: preferredCurrency,
  categories,
  year,
  month,
  monthLabel,
  onClose,
  onSubmit,
}: WeeklyExpenseDialogProps) {
  const weeks = useMemo(() => monthWeekOptions(year, month), [year, month])
  const [weekEnding, setWeekEnding] = useState(() => defaultMonthWeekValue(year, month, weeks))
  const [currency, setCurrency] = useState<CurrencyCode>(preferredCurrency)
  const [rows, setRows] = useState<ExpenseRow[]>(() => [emptyRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const expenseCategories = categories.filter(
    (category) => category.type === 'expense' && category.isActive,
  )

  function updateRow(id: number, changes: Partial<ExpenseRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!weeks.some((week) => week.value === weekEnding)) {
      setError('Select a weekly group for this month.')
      return
    }
    if (rows.some((row) => !row.categoryId)) {
      setError('Select a category for every expense.')
      return
    }
    if (new Set(rows.map((row) => row.categoryId)).size !== rows.length) {
      setError('Use each category only once per weekly review.')
      return
    }
    if (rows.some((row) => !row.amount || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0)) {
      setError('Every amount must be greater than 0.')
      return
    }
    if (rows.some((row) => row.description.trim().length > 240)) {
      setError('Notes must be 240 characters or fewer.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        weekEnding: `${weekEnding}T12:00:00Z`,
        currency,
        entries: rows.map((row) => ({
          categoryId: row.categoryId,
          amount: Number(row.amount),
          description: row.description.trim() || null,
        })),
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save weekly expenses.')
      setSaving(false)
    }
  }

  return (
    <Modal label="Add weekly expenses" onClose={onClose} dismissible={!saving}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Add weekly expenses
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Choose a week in {monthLabel}, then record one total for each spending category.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Weekly group
            <select
              value={weekEnding}
              onChange={(event) => setWeekEnding(event.target.value)}
              disabled={saving}
              className={inputClass}
            >
              {weeks.map((week) => (
                <option key={week.value} value={week.value}>{week.label}</option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs font-normal text-neutral-400 dark:text-neutral-500">
              Monday–Sunday, clipped to {monthLabel}.
            </span>
          </label>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Currency
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              disabled={saving}
              className={inputClass}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-3">
          {rows.map((row, index) => (
            <fieldset key={row.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Expense {index + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Category
                  <select
                    value={row.categoryId}
                    onChange={(event) => updateRow(row.id, { categoryId: event.target.value })}
                    disabled={saving}
                    className={inputClass}
                  >
                    <option value="">Select category</option>
                    {expenseCategories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                        disabled={rows.some(
                          (other) => other.id !== row.id && other.categoryId === category.id,
                        )}
                      >
                        {category.icon ? `${category.icon} ` : ''}{category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Total amount
                  <input
                    value={formatAmountInput(row.amount)}
                    onChange={(event) => updateRow(row.id, {
                      amount: sanitizePositiveAmountInput(event.target.value),
                    })}
                    disabled={saving}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Note <span className="font-normal text-neutral-400">(optional)</span>
                  <input
                    value={row.description}
                    onChange={(event) => updateRow(row.id, { description: event.target.value })}
                    disabled={saving}
                    maxLength={240}
                    placeholder="Weekly total"
                    className={inputClass}
                  />
                </label>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                    disabled={saving}
                    aria-label={`Remove expense ${index + 1}`}
                    className="mb-0.5 h-10 rounded-xl px-3 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                )}
              </div>
            </fieldset>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows((current) => [...current, emptyRow()])}
          disabled={saving || rows.length >= Math.min(20, expenseCategories.length)}
          className="mt-3 rounded-full px-4 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-40 dark:text-violet-400 dark:hover:bg-violet-950/30"
        >
          + Add another category
        </button>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
          <button type="submit" disabled={saving || expenseCategories.length === 0} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400">
            {saving ? 'Saving…' : `Save ${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
