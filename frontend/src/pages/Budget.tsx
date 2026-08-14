import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api'
import { BudgetEditorDialog } from '../components/budget/BudgetEditorDialog'
import { BudgetResetDialog } from '../components/budget/BudgetResetDialog'
import { useCategories } from '../hooks/useCategories'
import { useMonthlyBudget } from '../hooks/useMonthlyBudget'
import { useMonthlyClose } from '../hooks/useMonthlyClose'
import { formatCurrency } from '../lib/currency'
import type { MonthlyBudgetAllocation, MonthlyBudgetInput, MonthlyBudgetSummary } from '../types'

function selectedMonth(searchParams: URLSearchParams): { year: number; month: number } {
  const today = new Date()
  const fallback = { year: today.getFullYear(), month: today.getMonth() + 1 }
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!Number.isInteger(year) || year < 1 || year > 9999) return fallback
  if (!Number.isInteger(month) || month < 1 || month > 12) return fallback
  return { year, month }
}

function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function moneyTone(amount: number | null): string {
  if (amount !== null && amount < 0) return 'text-rose-600 dark:text-rose-400'
  return 'text-neutral-900 dark:text-neutral-50'
}

function utilizationTone(percent: number): { bar: string; label: string; text: string } {
  if (percent > 100) return { bar: 'bg-rose-500', label: 'Over budget', text: 'text-rose-600 dark:text-rose-400' }
  if (percent >= 80) return { bar: 'bg-amber-500', label: 'Watch', text: 'text-amber-700 dark:text-amber-300' }
  return { bar: 'bg-emerald-500', label: 'On track', text: 'text-emerald-700 dark:text-emerald-300' }
}

export function BudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { year, month } = useMemo(() => selectedMonth(searchParams), [searchParams])
  const budgetState = useMonthlyBudget(year, month)
  const closeState = useMonthlyClose(year, month)
  const categoriesState = useCategories(true)
  const [showEditor, setShowEditor] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [copying, setCopying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const label = monthName(year, month)
  const summary = budgetState.summary
  const now = new Date()
  const selectedKey = year * 12 + month
  const currentKey = now.getFullYear() * 12 + now.getMonth() + 1
  const period = selectedKey < currentKey ? 'past' : selectedKey > currentKey ? 'future' : 'current'

  function navigateMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1))
    setSearchParams({ year: String(next.getUTCFullYear()), month: String(next.getUTCMonth() + 1) })
    setActionError(null)
  }

  async function handleSave(input: MonthlyBudgetInput) {
    await budgetState.save(input)
    setShowEditor(false)
    setActionError(null)
  }

  async function handleCopy() {
    setCopying(true)
    setActionError(null)
    try {
      await budgetState.copyPrevious()
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Could not copy the previous month.')
    } finally {
      setCopying(false)
    }
  }

  async function handleReset() {
    await budgetState.reset()
    setShowReset(false)
    setActionError(null)
  }

  const error = budgetState.error || categoriesState.error || actionError

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Monthly Budget</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Spending plan</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            Reserve savings, set category boundaries, and see what is still safe to spend.
          </p>
          <div className="mt-3 inline-flex items-center rounded-full border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <button type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">←</button>
            <span className="min-w-36 px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
            <button type="button" onClick={() => navigateMonth(1)} aria-label="Next month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">→</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/monthly-routine?year=${year}&month=${month}`} className="text-sm font-medium text-neutral-600 hover:text-violet-600 dark:text-neutral-300 dark:hover:text-violet-400">Monthly Routine</Link>
          <Link to={`/monthly-close?year=${year}&month=${month}`} className="text-sm font-medium text-neutral-600 hover:text-violet-600 dark:text-neutral-300 dark:hover:text-violet-400">
            Month Close{closeState.summary?.status === 'closed' ? ': Closed' : closeState.summary?.status === 'needs_review' ? ': Needs review' : ''}
          </Link>
          <Link to={`/cashflow?year=${year}&month=${month}`} className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">Cash Flow →</Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      {summary && <BudgetFxNotice summary={summary} />}

      {budgetState.loading || categoriesState.loading || !summary ? (
        <BudgetSkeleton />
      ) : !summary.hasBudget ? (
        <BudgetOnboarding
          summary={summary}
          monthLabel={label}
          copying={copying}
          onCreate={() => setShowEditor(true)}
          onCopy={handleCopy}
        />
      ) : (
        <BudgetPlan
          summary={summary}
          monthLabel={label}
          period={period}
          onEdit={() => setShowEditor(true)}
          onReset={() => setShowReset(true)}
        />
      )}

      {showEditor && summary && (
        <BudgetEditorDialog
          summary={summary}
          categories={categoriesState.categories}
          onClose={() => setShowEditor(false)}
          onSave={handleSave}
        />
      )}
      {showReset && (
        <BudgetResetDialog
          monthLabel={label}
          onClose={() => setShowReset(false)}
          onReset={handleReset}
        />
      )}
    </section>
  )
}

function BudgetOnboarding({
  summary,
  monthLabel,
  copying,
  onCreate,
  onCopy,
}: {
  summary: MonthlyBudgetSummary
  monthLabel: string
  copying: boolean
  onCreate: () => void
  onCopy: () => void
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="grid gap-8 px-6 py-8 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] md:items-center sm:px-8 sm:py-10">
        <div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl dark:bg-violet-500/10" aria-hidden="true">◎</div>
          <h3 className="mt-5 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Give {monthLabel} a spending plan</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            Choose a savings target and allocate variable spending by category. Your recorded expenses will be compared automatically without generating transactions.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={onCreate} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400">Create spending plan</button>
            <button type="button" onClick={onCopy} disabled={copying} className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">{copying ? 'Copying…' : 'Copy previous month'}</button>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          <OnboardingMetric label="Available after commitments" value={formatCurrency(summary.baselineAvailable, summary.currency)} />
          <OnboardingMetric label="Manual spending so far" value={formatCurrency(summary.actualVariableExpenseTotal, summary.currency)} />
        </dl>
      </div>
      <p className="border-t border-neutral-200/80 px-6 py-4 text-xs text-neutral-500 sm:px-8 dark:border-neutral-800 dark:text-neutral-400">
        Budget plans are month snapshots. They do not alter Cash Flow, recurring schedules, loans, or Saving Pot balances.
      </p>
    </article>
  )
}

function OnboardingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-neutral-50 px-4 py-4 dark:bg-neutral-950/60">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-2 break-words text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{value}</dd>
    </div>
  )
}

function BudgetPlan({
  summary,
  monthLabel,
  period,
  onEdit,
  onReset,
}: {
  summary: MonthlyBudgetSummary
  monthLabel: string
  period: 'past' | 'current' | 'future'
  onEdit: () => void
  onReset: () => void
}) {
  const planned = summary.plannedVariableBudgetTotal ?? 0
  const spent = summary.actualVariableExpenseTotal
  const overallUtilization = planned > 0 ? spent / planned * 100 : spent > 0 ? 100 : 0
  const overallProgress = summary.budgetComparisonComplete ? overallUtilization : 0
  const overallTone = utilizationTone(overallUtilization)

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
          <div className="bg-gradient-to-br from-violet-50 to-white px-6 py-6 sm:px-7 dark:from-violet-950/35 dark:to-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Safe to spend</p>
                {summary.safeToSpend === null ? (
                  <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">Unavailable</p>
                ) : (
                  <p className={`mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${moneyTone(summary.safeToSpend)}`}>
                    {formatCurrency(summary.safeToSpend, summary.currency)}
                  </p>
                )}
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Variable budget minus all manual variable spending, including unbudgeted categories.
                </p>
              </div>
              {summary.dailySafeToSpend !== null ? (
                <div className="rounded-2xl border border-violet-200/70 bg-white/80 px-4 py-3 text-right dark:border-violet-900/70 dark:bg-neutral-900/80">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Daily pace</p>
                  <p className="mt-1 font-semibold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(summary.dailySafeToSpend, summary.currency)}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-400">Including today</p>
                </div>
              ) : (
                <span className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300">
                  {period === 'past' ? 'Final month result' : period === 'future' ? 'Planning only' : 'No daily allowance'}
                </span>
              )}
            </div>
          </div>
          <div className="px-6 py-5 sm:px-7">
            <div className="flex items-end justify-between gap-4 text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Overall manual spending</span>
              <span className={`text-right font-semibold tabular-nums ${summary.budgetComparisonComplete ? overallTone.text : 'text-amber-700 dark:text-amber-300'}`}>
                {summary.budgetComparisonComplete ? `${overallUtilization.toFixed(overallUtilization % 1 ? 1 : 0)}% · ${overallTone.label}` : 'Comparison incomplete'}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" role="progressbar" aria-label={summary.budgetComparisonComplete ? `Overall manual spending: ${overallUtilization.toFixed(1)} percent of variable budget` : 'Overall manual spending comparison is incomplete because currency conversion failed'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.max(overallProgress, 0), 100)}>
              <div className={`h-full rounded-full ${summary.budgetComparisonComplete ? overallTone.bar : 'bg-amber-500'}`} style={{ width: `${Math.min(Math.max(overallProgress, 0), 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{formatCurrency(spent, summary.currency)} spent</span>
              <span>{formatCurrency(planned, summary.currency)} planned</span>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Plan structure</h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">How your baseline is assigned.</p>
            </div>
            <button type="button" onClick={onEdit} className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">Edit</button>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <PlanMetric label="Baseline available" value={summary.baselineAvailable} summary={summary} />
            <PlanMetric label="Planned savings" value={summary.plannedSavingsAmount} summary={summary} prefix="−" />
            <PlanMetric label="Variable budget" value={summary.plannedVariableBudgetTotal} summary={summary} />
            <PlanMetric label="Unallocated buffer" value={summary.unallocatedBuffer} summary={summary} emphasized />
          </dl>
          {(summary.unallocatedBuffer ?? 0) < 0 && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              Savings plus allocations exceed your baseline by {formatCurrency(Math.abs(summary.unallocatedBuffer ?? 0), summary.currency)}.
            </p>
          )}
        </article>
      </div>

      <section className="mt-6" aria-labelledby="category-budgets-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="category-budgets-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Category budgets</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Manual expenses compared with your {monthLabel} allocations.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onEdit} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400">Edit plan</button>
            <button type="button" onClick={onReset} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:border-rose-300 hover:text-rose-600 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-rose-800 dark:hover:text-rose-400">Reset</button>
          </div>
        </div>

        {summary.allocations.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
            <p className="font-medium text-neutral-800 dark:text-neutral-200">No category allocations yet</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Edit the plan to add variable spending limits.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {summary.allocations.map((allocation) => (
              <CategoryBudgetCard key={allocation.categoryId} allocation={allocation} currency={summary.currency} comparisonComplete={summary.budgetComparisonComplete} />
            ))}
          </div>
        )}
      </section>

      {summary.unbudgetedCategories.length > 0 && (
        <article className="mt-5 overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25">
          <div className="flex flex-col gap-3 border-b border-amber-200/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-amber-900/50">
            <div>
              <h3 className="font-semibold text-amber-950 dark:text-amber-100">Unbudgeted spending</h3>
              <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/75">These manual expenses still reduce your overall safe-to-spend amount.</p>
            </div>
            <p className="font-semibold tabular-nums text-amber-950 dark:text-amber-100">{formatCurrency(summary.unbudgetedSpendTotal ?? 0, summary.currency)}</p>
          </div>
          <ul className="divide-y divide-amber-200/70 dark:divide-amber-900/50">
            {summary.unbudgetedCategories.map((category) => (
              <li key={category.categoryId} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                <span className="truncate font-medium text-amber-950 dark:text-amber-100">{category.categoryIcon ? `${category.categoryIcon} ` : ''}{category.categoryName}</span>
                <span className="shrink-0 tabular-nums text-amber-900 dark:text-amber-200">{formatCurrency(category.actualSpent, summary.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4">
            <button type="button" onClick={onEdit} className="text-sm font-medium text-amber-900 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100">Add categories to the plan →</button>
          </div>
        </article>
      )}
    </>
  )
}

function PlanMetric({ label, value, summary, prefix = '', emphasized = false }: { label: string; value: number | null; summary: MonthlyBudgetSummary; prefix?: string; emphasized?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${emphasized ? 'border-t border-neutral-200 pt-3 dark:border-neutral-800' : ''}`}>
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className={`text-right font-semibold tabular-nums ${moneyTone(value)}`}>{value === null ? '—' : `${prefix}${formatCurrency(value, summary.currency)}`}</dd>
    </div>
  )
}

function CategoryBudgetCard({ allocation, currency, comparisonComplete }: { allocation: MonthlyBudgetAllocation; currency: MonthlyBudgetSummary['currency']; comparisonComplete: boolean }) {
  const percent = allocation.utilizationPercent ?? 0
  const tone = utilizationTone(percent)
  return (
    <article className="min-w-0 rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-neutral-900 dark:text-neutral-100">{allocation.categoryIcon ? `${allocation.categoryIcon} ` : ''}{allocation.categoryName}</h4>
          {!allocation.categoryActive && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Inactive category retained for history</p>}
        </div>
        <p className={`shrink-0 text-sm font-semibold ${comparisonComplete ? tone.text : 'text-amber-700 dark:text-amber-300'}`}>
          {comparisonComplete ? `${percent.toFixed(percent % 1 ? 1 : 0)}%` : 'Incomplete'}
        </p>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" role="progressbar" aria-label={`${allocation.categoryName}: ${percent.toFixed(1)} percent used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.max(percent, 0), 100)}>
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <CategoryMetric label="Budget" value={formatCurrency(allocation.allocatedAmount, currency)} />
        <CategoryMetric label="Spent" value={formatCurrency(allocation.actualSpent, currency)} />
        <CategoryMetric label="Remaining" value={allocation.remainingAmount === null ? '—' : formatCurrency(allocation.remainingAmount, currency)} negative={(allocation.remainingAmount ?? 0) < 0} />
      </dl>
      <p className={`mt-3 text-xs font-medium ${comparisonComplete ? tone.text : 'text-amber-700 dark:text-amber-300'}`}>
        {comparisonComplete ? `${tone.label} · ${formatCurrency(allocation.remainingAmount ?? 0, currency)} remaining` : 'Waiting for complete currency conversion'}
      </p>
    </article>
  )
}

function CategoryMetric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className={`mt-1 break-words font-semibold tabular-nums ${negative ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-neutral-100'}`}>{value}</dd>
    </div>
  )
}

function BudgetFxNotice({ summary }: { summary: MonthlyBudgetSummary }) {
  if (summary.unconvertedCurrencies.length > 0) {
    return (
      <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        Could not convert {summary.unconvertedCurrencies.join(', ')} into {summary.currency}. Safe-to-spend and remaining amounts are withheld until actual spending can be compared completely.
      </p>
    )
  }
  if (summary.convertedCurrencies.length === 0) return null
  return (
    <details className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
      <summary className="cursor-pointer font-medium">Historical FX applied for {summary.convertedCurrencies.join(', ')}</summary>
      <p className="mt-2 text-xs leading-5">
        Actual spending was converted into {summary.currency}{summary.exchangeRateProvider ? ` with ${summary.exchangeRateProvider}` : ''}. {summary.conversionRates.map((rate) => `${rate.sourceCurrency}/${rate.targetCurrency} ${rate.rate} on ${rate.rateDate}`).join(' · ')}
      </p>
    </details>
  )
}

function BudgetSkeleton() {
  return (
    <div className="grid animate-pulse gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]" aria-label="Loading monthly budget">
      <div className="h-72 rounded-3xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
      <div className="h-72 rounded-3xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
    </div>
  )
}
