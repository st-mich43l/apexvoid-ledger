import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createRecurringIncome,
  deactivateRecurringIncome,
  reactivateRecurringIncome,
  updateRecurringIncome,
} from '../api'
import { RecurringIncomeFormDialog } from '../components/routine/RecurringIncomeFormDialog'
import { RecurringIncomeManageDialog } from '../components/routine/RecurringIncomeManageDialog'
import { useCurrency } from '../context/CurrencyContext'
import { useCategories } from '../hooks/useCategories'
import { useMonthlyRoutine } from '../hooks/useMonthlyRoutine'
import { useRecurringIncomes } from '../hooks/useRecurringIncomes'
import { formatCurrency } from '../lib/currency'
import { formatDate } from '../lib/date'
import type {
  RecurringIncome,
  RecurringIncomeInput,
  RecurringIncomeUpdateInput,
} from '../types'

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

function moneyTone(amount: number): string {
  if (amount < 0) return 'text-rose-600 dark:text-rose-400'
  return 'text-neutral-900 dark:text-neutral-50'
}

export function MonthlyRoutinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { year, month } = useMemo(() => selectedMonth(searchParams), [searchParams])
  const { currency } = useCurrency()
  const categoriesState = useCategories(true)
  const routineState = useMonthlyRoutine(year, month, currency)
  const incomesState = useRecurringIncomes()
  const [showAdd, setShowAdd] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [editing, setEditing] = useState<RecurringIncome | null>(null)
  const label = monthName(year, month)
  const summary = routineState.summary
  const incomeControlsReady = !incomesState.loading
    && !incomesState.error
    && !categoriesState.loading
    && !categoriesState.error
  const isInitialIncomeSetup = incomeControlsReady && incomesState.items.length === 0

  function navigateMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1))
    setSearchParams({ year: String(next.getUTCFullYear()), month: String(next.getUTCMonth() + 1) })
  }

  async function refresh() {
    await Promise.all([routineState.reload(), incomesState.reload()])
  }

  async function handleCreate(input: RecurringIncomeInput) {
    await createRecurringIncome(input)
    await refresh()
    setShowAdd(false)
  }

  async function handleUpdate(id: string, input: RecurringIncomeUpdateInput) {
    await updateRecurringIncome(id, input)
    await refresh()
    setEditing(null)
    setShowManage(true)
  }

  async function handleStop(id: string, effectiveFromMonth: string) {
    await deactivateRecurringIncome(id, effectiveFromMonth)
    await refresh()
  }

  async function handleResume(id: string, resumeFromMonth: string) {
    await reactivateRecurringIncome(id, resumeFromMonth)
    await refresh()
  }

  const error = categoriesState.error || routineState.error || incomesState.error

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Monthly Routine</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Normal monthly plan</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            Expected income, fixed commitments, and current variable spending — before discretionary choices.
          </p>
          <div className="mt-3 inline-flex items-center rounded-full border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <button type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">←</button>
            <span className="min-w-36 px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
            <button type="button" onClick={() => navigateMonth(1)} aria-label="Next month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">→</button>
          </div>
        </div>
        <Link to="/cashflow" className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">
          Open Cash Flow →
        </Link>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">{error}</p>}

      {summary?.unconvertedCurrencies.length ? (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Could not convert {summary.unconvertedCurrencies.join(', ')} into {summary.currency}. Native amounts remain visible; converted totals exclude those values.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Expected income"
          value={summary ? formatCurrency(summary.expectedIncomeTotal, currency) : '—'}
          loading={routineState.loading}
        />
        <SummaryCard
          label="Committed costs"
          value={summary ? formatCurrency(summary.committedExpenseTotal, currency) : '—'}
          loading={routineState.loading}
        />
        <SummaryCard
          label="Baseline available"
          value={summary ? formatCurrency(summary.baselineAvailable, currency) : '—'}
          loading={routineState.loading}
          tone={summary ? moneyTone(summary.baselineAvailable) : undefined}
          hint={summary && summary.baselineAvailable < 0 ? 'Projected deficit before variable spending' : 'After fixed bills and loans'}
        />
        <SummaryCard
          label="Projected remainder"
          value={summary ? formatCurrency(summary.projectedRemainder, currency) : '—'}
          loading={routineState.loading}
          tone={summary ? moneyTone(summary.projectedRemainder) : undefined}
          hint="Baseline minus actual variable spending"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-3 border-b border-neutral-200/80 px-5 py-5 sm:flex-row sm:items-start sm:justify-between dark:border-neutral-800">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Expected income</h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Automatically mapped into Cash Flow for every covered month.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {incomeControlsReady && (
                <button type="button" onClick={() => setShowAdd(true)} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
                  {isInitialIncomeSetup ? 'Set default income' : '+ Add additional income'}
                </button>
              )}
              {incomesState.items.length > 0 && (
                <button type="button" onClick={() => setShowManage(true)} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Manage</button>
              )}
            </div>
          </div>
          <div className="border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
            <p className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
              {summary ? formatCurrency(summary.expectedIncomeTotal, currency) : '—'}
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Actual recorded {summary ? formatCurrency(summary.actualIncomeTotal, currency) : '—'}
            </p>
          </div>
          {!summary || routineState.loading || incomesState.loading ? (
            <p className="p-6 text-sm text-neutral-500">Loading…</p>
          ) : summary.expectedIncome.length === 0 ? (
            isInitialIncomeSetup ? (
              <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-violet-50 text-xl dark:bg-violet-500/10" aria-hidden="true">💼</div>
                <p className="mt-4 font-semibold text-neutral-900 dark:text-neutral-100">Start with your regular monthly income</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  Set a default salary or other reliable income to make your monthly plan useful. You can update it or add extra income later.
                </p>
                <button type="button" onClick={() => setShowAdd(true)} className="mt-5 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500">
                  Set default income
                </button>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">No income expected this month</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Your configured income may start later, have ended, or be paused for this month.
                </p>
              </div>
            )
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {summary.expectedIncome.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {item.categoryIcon ? `${item.categoryIcon} ` : ''}{item.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.categoryName} · Expected {formatDate(item.expectedAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(item.amount, item.currency)}
                    {item.reportingAmount !== null && item.currency !== item.reportingCurrency && (
                      <span className="block text-[11px] font-normal text-neutral-400">≈ {formatCurrency(item.reportingAmount, item.reportingCurrency)}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200/80 px-5 py-5 dark:border-neutral-800">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Committed costs</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Fixed bills and loan obligations already included in Cash Flow.
            </p>
            <p className="mt-3 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
              {summary ? formatCurrency(summary.committedExpenseTotal, currency) : '—'}
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Fixed {summary ? formatCurrency(summary.fixedExpenseTotal, currency) : '—'} · Loans{' '}
              {summary ? formatCurrency(summary.loanPaymentTotal, currency) : '—'}
            </p>
          </div>
          {!summary || routineState.loading ? (
            <p className="p-6 text-sm text-neutral-500">Loading…</p>
          ) : summary.fixedExpenses.length + summary.loanPayments.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">No committed costs this month.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {summary.fixedExpenses.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {item.categoryIcon ? `${item.categoryIcon} ` : ''}{item.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      Fixed cost · Due {formatDate(item.dueAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    −{formatCurrency(item.amount, item.currency)}
                  </p>
                </li>
              ))}
              {summary.loanPayments.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">🏦 {item.bankName}</p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      Loan · Term {item.term} · Due {formatDate(item.dueAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    −{formatCurrency(item.amount, item.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
            <Link to="/cashflow" className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">
              Manage fixed costs in Cash Flow →
            </Link>
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200/80 px-5 py-5 dark:border-neutral-800">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Variable spending</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Actual manual expenses recorded in Cash Flow.</p>
            <p className="mt-3 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
              {summary ? formatCurrency(summary.actualVariableExpenseTotal, currency) : '—'}
            </p>
          </div>
          {!summary || routineState.loading ? (
            <p className="p-6 text-sm text-neutral-500">Loading…</p>
          ) : summary.variableCategories.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">No variable spending this month.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {summary.variableCategories.map((item) => (
                <li key={item.categoryId} className="flex items-center justify-between gap-4 px-5 py-4">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {item.icon ? `${item.icon} ` : ''}{item.name}
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    −{formatCurrency(item.amount, currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="px-5 py-5">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Income this month</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Scheduled income is mapped automatically; actual recorded shows manual Cash Flow transactions only.
            </p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-neutral-50 px-4 py-4 dark:bg-neutral-950/50">
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Expected</dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {summary ? formatCurrency(summary.expectedIncomeTotal, currency) : '—'}
                </dd>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-4 py-4 dark:bg-neutral-950/50">
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Actual recorded</dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {summary ? formatCurrency(summary.actualIncomeTotal, currency) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </article>
      </div>

      {showAdd && (
        <RecurringIncomeFormDialog
          mode="create"
          isInitialSetup={isInitialIncomeSetup}
          currency={currency}
          categories={categoriesState.categories}
          year={year}
          month={month}
          onClose={() => setShowAdd(false)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
      {editing && (
        <RecurringIncomeFormDialog
          mode="edit"
          currency={currency}
          categories={categoriesState.categories}
          year={year}
          month={month}
          income={editing}
          onClose={() => {
            setEditing(null)
            setShowManage(true)
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
      {showManage && !editing && (
        <RecurringIncomeManageDialog
          items={incomesState.items}
          year={year}
          month={month}
          onClose={() => setShowManage(false)}
          onEdit={(income) => {
            setShowManage(false)
            setEditing(income)
          }}
          onStop={handleStop}
          onResume={handleResume}
        />
      )}
    </section>
  )
}

function SummaryCard({
  label,
  value,
  loading,
  tone,
  hint,
}: {
  label: string
  value: string
  loading: boolean
  tone?: string
  hint?: string
}) {
  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${tone ?? 'text-neutral-900 dark:text-neutral-50'}`}>
        {loading ? '…' : value}
      </p>
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  )
}
