import { useMemo, useState } from 'react'
import { ApiError } from '../../api'
import { formatAmountInput, sanitizePositiveAmountInput } from '../../hooks/useTransactionFormState'
import { formatCurrency } from '../../lib/currency'
import type { Category, MonthlyBudgetInput, MonthlyBudgetSummary } from '../../types'
import { Modal } from '../Modal'

interface AllocationDraft {
  categoryId: string
  amount: string
}

interface BudgetEditorDialogProps {
  summary: MonthlyBudgetSummary
  categories: Category[]
  onClose: () => void
  onSave: (input: MonthlyBudgetInput) => Promise<void>
}

function initialAllocations(summary: MonthlyBudgetSummary): AllocationDraft[] {
  return summary.allocations.map((allocation) => ({
    categoryId: allocation.categoryId,
    amount: sanitizePositiveAmountInput(String(allocation.allocatedAmount)),
  }))
}

export function BudgetEditorDialog({
  summary,
  categories,
  onClose,
  onSave,
}: BudgetEditorDialogProps) {
  const [plannedSavings, setPlannedSavings] = useState(
    summary.plannedSavingsAmount === null
      ? ''
      : sanitizePositiveAmountInput(String(summary.plannedSavingsAmount)),
  )
  const [allocations, setAllocations] = useState<AllocationDraft[]>(() => initialAllocations(summary))
  const [addCategoryId, setAddCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const selectedIds = new Set(allocations.map((allocation) => allocation.categoryId))
  const availableCategories = categories.filter(
    (category) => category.type === 'expense' && category.isActive && !selectedIds.has(category.id),
  )
  const parsedSavings = Number(plannedSavings || 0)
  const allocationTotal = allocations.reduce((total, allocation) => {
    const amount = Number(allocation.amount)
    return total + (Number.isFinite(amount) ? amount : 0)
  }, 0)
  const availableForPlanning = summary.baselineAvailable - (Number.isFinite(parsedSavings) ? parsedSavings : 0)
  const previewBuffer = availableForPlanning - allocationTotal
  const hasUnavailableCategory = allocations.some(
    (allocation) => !categoryById.get(allocation.categoryId)?.isActive,
  )

  function addCategory(categoryId: string) {
    setAddCategoryId('')
    if (!categoryId || selectedIds.has(categoryId)) return
    setAllocations((current) => [...current, { categoryId, amount: '' }])
  }

  function updateAmount(categoryId: string, value: string) {
    setAllocations((current) => current.map((allocation) => (
      allocation.categoryId === categoryId
        ? { ...allocation, amount: sanitizePositiveAmountInput(value) }
        : allocation
    )))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!Number.isFinite(parsedSavings) || parsedSavings < 0) {
      setError('Planned savings must be zero or greater.')
      return
    }
    if (hasUnavailableCategory) {
      setError('Remove inactive categories before saving this updated plan.')
      return
    }
    const invalid = allocations.find((allocation) => {
      const amount = Number(allocation.amount)
      return !allocation.amount || !Number.isFinite(amount) || amount <= 0
    })
    if (invalid) {
      setError('Every category allocation must be greater than zero.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        currency: summary.currency,
        plannedSavings: parsedSavings,
        allocations: allocations.map((allocation) => ({
          categoryId: allocation.categoryId,
          amount: Number(allocation.amount),
        })),
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this spending plan.')
      setSaving(false)
    }
  }

  return (
    <Modal
      label={summary.hasBudget ? 'Edit monthly spending plan' : 'Create monthly spending plan'}
      onClose={onClose}
      dismissible={!saving}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {summary.hasBudget ? 'Edit spending plan' : 'Create spending plan'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Reserve savings, then set limits for manual variable expenses.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {summary.currency}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Planned savings
            <input
              autoFocus
              inputMode="decimal"
              value={formatAmountInput(plannedSavings)}
              onChange={(event) => setPlannedSavings(sanitizePositiveAmountInput(event.target.value))}
              disabled={saving}
              placeholder="0"
              className="mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <div className="rounded-2xl bg-neutral-50 px-4 py-3 dark:bg-neutral-950/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Baseline available</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
              {formatCurrency(summary.baselineAvailable, summary.currency)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Category allocations</h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Manual expenses consume these limits; fixed costs and loans do not.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
            {formatCurrency(allocationTotal, summary.currency)}
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {allocations.map((allocation) => {
            const category = categoryById.get(allocation.categoryId)
            return (
              <div key={allocation.categoryId} className="grid gap-3 rounded-2xl border border-neutral-200/80 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.75fr)_auto] sm:items-center dark:border-neutral-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {category?.icon ? `${category.icon} ` : ''}{category?.name ?? 'Unavailable category'}
                  </p>
                  {!category?.isActive && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Inactive — remove before saving</p>
                  )}
                </div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  <span className="sr-only">Allocation for {category?.name ?? 'category'}</span>
                  <input
                    inputMode="decimal"
                    value={formatAmountInput(allocation.amount)}
                    onChange={(event) => updateAmount(allocation.categoryId, event.target.value)}
                    disabled={saving}
                    placeholder="0"
                    aria-label={`Allocation for ${category?.name ?? 'category'} in ${summary.currency}`}
                    className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setAllocations((current) => current.filter((item) => item.categoryId !== allocation.categoryId))}
                  disabled={saving}
                  className="rounded-full px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-rose-600 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-rose-400"
                >
                  Remove
                </button>
              </div>
            )
          })}
          {allocations.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Add categories you want to actively limit this month.
            </p>
          )}
        </div>

        <label className="mt-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Add a category
          <select
            value={addCategoryId}
            onChange={(event) => addCategory(event.target.value)}
            disabled={saving || availableCategories.length === 0}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-violet-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="">{availableCategories.length ? 'Choose expense category…' : 'All active expense categories added'}</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon ? `${category.icon} ` : ''}{category.name}
              </option>
            ))}
          </select>
        </label>

        <dl className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-4 text-sm sm:grid-cols-3 dark:bg-neutral-950/60">
          <PreviewMetric label="After savings" value={formatCurrency(availableForPlanning, summary.currency)} />
          <PreviewMetric label="Allocated" value={formatCurrency(allocationTotal, summary.currency)} />
          <PreviewMetric label="Unallocated" value={formatCurrency(previewBuffer, summary.currency)} negative={previewBuffer < 0} />
        </dl>
        {previewBuffer < 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            Your allocations exceed the amount available after planned savings. You can still save this intentional over-plan.
          </p>
        )}
        <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          This is planning data only. Saving it does not create transactions or move your Saving Pot balance.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400">
            {saving ? 'Saving…' : summary.hasBudget ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function PreviewMetric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className={`mt-1 font-semibold tabular-nums ${negative ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-neutral-100'}`}>{value}</dd>
    </div>
  )
}
