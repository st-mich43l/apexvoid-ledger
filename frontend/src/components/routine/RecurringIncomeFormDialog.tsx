import { useMemo, useState } from 'react'
import { ApiError } from '../../api'
import {
  formatAmountInput,
  sanitizePositiveAmountInput,
} from '../../hooks/useTransactionFormState'
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../lib/currency'
import type {
  Category,
  RecurringIncome,
  RecurringIncomeInput,
  RecurringIncomeUpdateInput,
} from '../../types'
import { Modal } from '../Modal'

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

interface RecurringIncomeFormDialogProps {
  mode: 'create' | 'edit'
  currency: CurrencyCode
  categories: Category[]
  year: number
  month: number
  income?: RecurringIncome
  onClose: () => void
  onCreate: (input: RecurringIncomeInput) => Promise<void>
  onUpdate: (id: string, input: RecurringIncomeUpdateInput) => Promise<void>
}

export function RecurringIncomeFormDialog({
  mode,
  currency,
  categories,
  year,
  month,
  income,
  onClose,
  onCreate,
  onUpdate,
}: RecurringIncomeFormDialogProps) {
  const incomeCategories = useMemo(
    () => categories.filter((item) => item.type === 'income' && item.isActive),
    [categories],
  )
  const defaultMonth = monthKey(year, month)
  const [name, setName] = useState(income?.name ?? '')
  const [categoryId, setCategoryId] = useState(income?.categoryId ?? incomeCategories[0]?.id ?? '')
  const [amount, setAmount] = useState(income ? sanitizePositiveAmountInput(String(income.amount)) : '')
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(income?.currency ?? currency)
  const [expectedDay, setExpectedDay] = useState(String(income?.expectedDay ?? 25))
  const [startMonth, setStartMonth] = useState(income?.startMonth ?? defaultMonth)
  const [endMonth, setEndMonth] = useState(income?.endMonth ?? '')
  const [effectiveFromMonth, setEffectiveFromMonth] = useState(defaultMonth)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const historicalWarning = mode === 'edit' && effectiveFromMonth < defaultMonth

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsedAmount = Number(amount)
    const parsedExpectedDay = Number(expectedDay)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!categoryId) {
      setError('Choose an income category.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }
    if (!Number.isInteger(parsedExpectedDay) || parsedExpectedDay < 1 || parsedExpectedDay > 31) {
      setError('Expected day must be between 1 and 31.')
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        await onCreate({
          name: name.trim(),
          categoryId,
          amount: parsedAmount,
          currency: selectedCurrency,
          expectedDay: parsedExpectedDay,
          startMonth,
          endMonth: endMonth || null,
        })
      } else if (income) {
        await onUpdate(income.id, {
          name: name.trim(),
          categoryId,
          amount: parsedAmount,
          currency: selectedCurrency,
          expectedDay: parsedExpectedDay,
          effectiveFromMonth,
          endMonth: endMonth || null,
        })
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this expected income.')
      setSaving(false)
    }
  }

  return (
    <Modal
      label={mode === 'create' ? 'Add expected income' : 'Edit expected income'}
      onClose={onClose}
      dismissible={!saving}
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {mode === 'create' ? 'Add expected income' : 'Edit expected income'}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {mode === 'create'
            ? 'This is a planning expectation — it does not create a Cash Flow transaction.'
            : 'Earlier months keep their previous values unless you change the effective month.'}
        </p>

        <div className="mt-6 grid gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
              maxLength={120}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Category</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={saving}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              {incomeCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.icon ? `${item.icon} ` : ''}
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Amount</span>
              <input
                inputMode="decimal"
                value={formatAmountInput(amount)}
                onChange={(event) => setAmount(sanitizePositiveAmountInput(event.target.value))}
                disabled={saving}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Currency</span>
              <select
                value={selectedCurrency}
                onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode)}
                disabled={saving}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Expected day</span>
            <input
              type="number"
              min={1}
              max={31}
              value={expectedDay}
              onChange={(event) => setExpectedDay(event.target.value)}
              disabled={saving}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
            <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
              Short months clamp to the last calendar day (e.g. 31 → Feb 28/29).
            </span>
          </label>

          {mode === 'create' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Start month</span>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(event) => setStartMonth(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">End month (optional)</span>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(event) => setEndMonth(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
              </label>
            </div>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">Changes apply from</span>
                <input
                  type="month"
                  value={effectiveFromMonth}
                  onChange={(event) => setEffectiveFromMonth(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
                <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                  Earlier months keep their previous values. Selected: {monthLabelFromKey(effectiveFromMonth)}.
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">End month (optional)</span>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(event) => setEndMonth(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
              </label>
              {historicalWarning && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  This changes the expected plan for a past month. It does not create or modify Cash Flow transactions.
                </p>
              )}
            </>
          )}
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
          <button type="submit" disabled={saving} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400">
            {saving ? 'Saving…' : mode === 'create' ? 'Add expected income' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
