import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createTransaction,
  createWeeklyExpenses,
  deleteTransaction,
  updateTransaction,
} from '../api'
import { CashFlowSummaryCards } from '../components/cashflow/CashFlowSummaryCards'
import { BankActivityList } from '../components/cashflow/BankActivityList'
import { SePayCategorizationRuleCard } from '../components/cashflow/SePayCategorizationRuleCard'
import { CategoryManagerDialog } from '../components/cashflow/CategoryManagerDialog'
import { CurrencyConversionNotice } from '../components/cashflow/CurrencyConversionNotice'
import { DeleteTransactionDialog } from '../components/cashflow/DeleteTransactionDialog'
import { IncomeExpenseChart } from '../components/cashflow/IncomeExpenseChart'
import { SpendingByCategory } from '../components/cashflow/SpendingByCategory'
import { TransactionFormDialog } from '../components/cashflow/TransactionFormDialog'
import { TransactionList } from '../components/cashflow/TransactionList'
import { WeeklyExpenseDialog } from '../components/cashflow/WeeklyExpenseDialog'
import { useCurrency } from '../context/CurrencyContext'
import { useCashFlowSummary } from '../hooks/useCashFlowSummary'
import { useBankActivities } from '../hooks/useBankActivities'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import type { LedgerTransaction, TransactionInput, WeeklyExpenseBatchInput } from '../types'

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

export function CashFlowPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { year, month } = useMemo(() => selectedMonth(searchParams), [searchParams])
  const { currency } = useCurrency()
  const categoriesState = useCategories(true)
  const transactionsState = useTransactions(year, month)
  const summaryState = useCashFlowSummary(year, month, currency)
  const bankActivitiesState = useBankActivities(year, month)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<LedgerTransaction | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LedgerTransaction | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showWeeklyExpenses, setShowWeeklyExpenses] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const label = monthName(year, month)

  useEffect(() => {
    if (!showInsights) return

    const wideDesktop = window.matchMedia('(min-width: 1816px)')
    if (wideDesktop.matches) {
      setShowInsights(false)
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowInsights(false)
    }

    function closeWhenRailBecomesAvailable(event: MediaQueryListEvent) {
      if (event.matches) setShowInsights(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    wideDesktop.addEventListener('change', closeWhenRailBecomesAvailable)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      wideDesktop.removeEventListener('change', closeWhenRailBecomesAvailable)
    }
  }, [showInsights])

  function navigateMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1))
    setSearchParams({ year: String(next.getUTCFullYear()), month: String(next.getUTCMonth() + 1) })
  }

  async function refreshFinancials() {
    await Promise.all([transactionsState.reload(), summaryState.reload(), bankActivitiesState.reload()])
  }

  async function handleCreate(input: TransactionInput) {
    await createTransaction(input)
    await refreshFinancials()
    setShowCreate(false)
  }

  async function handleUpdate(input: TransactionInput) {
    if (!editing) return
    await updateTransaction(editing.id, input)
    await refreshFinancials()
    setEditing(null)
  }

  async function handleWeeklyExpenses(input: WeeklyExpenseBatchInput) {
    await createWeeklyExpenses(input)
    await refreshFinancials()
    setShowWeeklyExpenses(false)
  }

  const error =
    categoriesState.error ||
    transactionsState.error ||
    summaryState.error ||
    bankActivitiesState.error

  return (
    <section>
      {showInsights && (
        <button
          type="button"
          aria-label="Close insights"
          className="fixed inset-0 z-40 bg-neutral-950/20 backdrop-blur-[1px] min-[1816px]:hidden"
          onClick={() => setShowInsights(false)}
        />
      )}

      <main className="relative mx-auto w-full max-w-6xl">
        {/* A centered 72rem main area needs a 113.5rem viewport for the 18rem rail, 1.5rem gutter, and a 1.25rem safe edge. */}
        <aside
          id="cash-flow-insights"
          aria-label="Cash flow insights"
          aria-modal={showInsights || undefined}
          role={showInsights ? 'dialog' : undefined}
          className={`${showInsights ? 'fixed inset-y-0 left-0 z-50 block' : 'hidden'} w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 min-[1816px]:absolute min-[1816px]:top-0 min-[1816px]:right-[calc(100%+1.5rem)] min-[1816px]:left-auto min-[1816px]:z-20 min-[1816px]:block min-[1816px]:max-h-[calc(100vh-3rem)] min-[1816px]:w-72 min-[1816px]:border-0 min-[1816px]:bg-transparent min-[1816px]:p-0 min-[1816px]:shadow-none`}
        >
          <div className="mb-4 flex items-center justify-between min-[1816px]:hidden">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">Insights</h3>
            <button type="button" autoFocus onClick={() => setShowInsights(false)} className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800">Close</button>
          </div>
          <div className="space-y-5">
            {summaryState.summary && <IncomeExpenseChart summary={summaryState.summary} />}
            {summaryState.summary && <SpendingByCategory summary={summaryState.summary} monthLabel={label} />}
            <BankActivityList
              activities={bankActivitiesState.activities}
              categories={categoriesState.categories}
              loading={bankActivitiesState.loading}
              monthLabel={label}
              onChanged={refreshFinancials}
            />
          </div>
        </aside>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Cash Flow</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Monthly overview</h2>
            <div className="mt-3 inline-flex items-center rounded-full border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <button type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">←</button>
              <span className="min-w-36 px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
              <button type="button" onClick={() => navigateMonth(1)} aria-label="Next month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">→</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowInsights(true)} aria-controls="cash-flow-insights" aria-expanded={showInsights} className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 min-[1816px]:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800">Show insights</button>
            <button type="button" onClick={() => setShowCategories(true)} className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800">Manage categories</button>
            <button type="button" onClick={() => setShowWeeklyExpenses(true)} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/60">Weekly expenses</button>
            <Link to="/monthly-routine" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800">Monthly Routine</Link>
            <Link to={`/budget?year=${year}&month=${month}`} className="self-center px-2 text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">View monthly budget</Link>
            <Link to={`/monthly-close?year=${year}&month=${month}`} className="self-center px-2 text-sm font-medium text-neutral-600 hover:text-violet-600 dark:text-neutral-300 dark:hover:text-violet-400">Monthly Close</Link>
            <button type="button" onClick={() => setShowCreate(true)} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400">+ Add transaction</button>
          </div>
        </div>

        <div className="min-w-0">
          {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">{error}</p>}
          {summaryState.summary && <CurrencyConversionNotice summary={summaryState.summary} />}
          {summaryState.summary && summaryState.summary.loanPaymentCount > 0 && (
            <p className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-200">
              Includes {summaryState.summary.loanPaymentCount} contractual loan {summaryState.summary.loanPaymentCount === 1 ? 'payment' : 'payments'} from your loan schedule. These entries update automatically when a loan changes and do not record whether payment was completed.
            </p>
          )}
          {summaryState.summary && summaryState.summary.recurringIncomeCount > 0 && (
            <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
              Includes {summaryState.summary.recurringIncomeCount} scheduled income {summaryState.summary.recurringIncomeCount === 1 ? 'entry' : 'entries'} from Monthly Routine. These entries map automatically to every covered month without creating manual transactions.
            </p>
          )}

          <CashFlowSummaryCards summary={summaryState.summary} loading={summaryState.loading} currency={currency} />

          <div className="mt-5 space-y-5">
            <SePayCategorizationRuleCard categories={categoriesState.categories} />
            <TransactionList
              transactions={transactionsState.transactions}
              recurringIncomes={summaryState.summary?.recurringIncomes ?? []}
              loanPayments={summaryState.summary?.loanPayments ?? []}
              recurringExpenses={summaryState.summary?.recurringExpenses ?? []}
              loading={transactionsState.loading || summaryState.loading}
              monthLabel={label}
              onAdd={() => setShowCreate(true)}
              onEdit={setEditing}
              onDelete={setPendingDelete}
            />
          </div>
        </div>
      </main>

      {showCreate && (
        <TransactionFormDialog currency={currency} categories={categoriesState.categories} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
      {editing && (
        <TransactionFormDialog currency={currency} categories={categoriesState.categories} transaction={editing} onClose={() => setEditing(null)} onSubmit={handleUpdate} />
      )}
      {pendingDelete && (
        <DeleteTransactionDialog transaction={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={async () => {
          await deleteTransaction(pendingDelete.id)
          await refreshFinancials()
          setPendingDelete(null)
        }} />
      )}
      {showCategories && (
        <CategoryManagerDialog categories={categoriesState.categories} onClose={() => setShowCategories(false)} onChanged={categoriesState.reload} />
      )}
      {showWeeklyExpenses && (
        <WeeklyExpenseDialog
          currency={currency}
          categories={categoriesState.categories}
          year={year}
          month={month}
          monthLabel={label}
          onClose={() => setShowWeeklyExpenses(false)}
          onSubmit={handleWeeklyExpenses}
        />
      )}
    </section>
  )
}
