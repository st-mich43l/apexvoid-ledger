import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createTransaction, createWeeklyExpenses, deleteTransaction, updateTransaction } from '../api'
import { BankActivityReviewDialog } from '../components/cashflow/BankActivityReviewDialog'
import { CashFlowActionsMenu } from '../components/cashflow/CashFlowActionsMenu'
import { CashFlowInsights } from '../components/cashflow/CashFlowInsights'
import { CashFlowSummaryCards } from '../components/cashflow/CashFlowSummaryCards'
import { CategoryManagerDialog } from '../components/cashflow/CategoryManagerDialog'
import { CurrencyConversionNotice } from '../components/cashflow/CurrencyConversionNotice'
import { DeleteTransactionDialog } from '../components/cashflow/DeleteTransactionDialog'
import { SePayCategorizationRuleCard } from '../components/cashflow/SePayCategorizationRuleCard'
import { TransactionFormDialog } from '../components/cashflow/TransactionFormDialog'
import { TransactionList } from '../components/cashflow/TransactionList'
import { WeeklyExpenseDialog } from '../components/cashflow/WeeklyExpenseDialog'
import { Modal } from '../components/Modal'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { useCurrency } from '../hooks/useCurrency'
import { useBankActivities } from '../hooks/useBankActivities'
import { useCashFlowSummary } from '../hooks/useCashFlowSummary'
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
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
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
  const [showBankReview, setShowBankReview] = useState(false)
  const label = monthName(year, month)

  useEffect(() => {
    if (!showInsights) return
    const wideDesktop = window.matchMedia('(min-width: 1816px)')
    if (wideDesktop.matches) { setShowInsights(false); return }
    const closeWhenRailBecomesAvailable = (event: MediaQueryListEvent) => { if (event.matches) setShowInsights(false) }
    wideDesktop.addEventListener('change', closeWhenRailBecomesAvailable)
    return () => wideDesktop.removeEventListener('change', closeWhenRailBecomesAvailable)
  }, [showInsights])

  function navigateMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1))
    setSearchParams({ year: String(next.getUTCFullYear()), month: String(next.getUTCMonth() + 1) })
  }

  async function refreshFinancials() {
    await Promise.all([transactionsState.reload(), summaryState.reload(), bankActivitiesState.reload()])
  }

  async function handleCreate(input: TransactionInput) { await createTransaction(input); await refreshFinancials(); setShowCreate(false) }
  async function handleUpdate(input: TransactionInput) { if (!editing) return; await updateTransaction(editing.id, input); await refreshFinancials(); setEditing(null) }
  async function handleWeeklyExpenses(input: WeeklyExpenseBatchInput) { await createWeeklyExpenses(input); await refreshFinancials(); setShowWeeklyExpenses(false) }

  const error = categoriesState.error || transactionsState.error || summaryState.error || bankActivitiesState.error
  const insights = <CashFlowInsights summary={summaryState.summary} activities={bankActivitiesState.activities} categories={categoriesState.categories} loading={bankActivitiesState.loading} monthLabel={label} onChanged={refreshFinancials} onReview={() => setShowBankReview(true)} />

  return <section>
    {showInsights && <Modal variant="drawer" label="Cash flow insights" onClose={() => setShowInsights(false)}><CashFlowInsights summary={summaryState.summary} activities={bankActivitiesState.activities} categories={categoriesState.categories} loading={bankActivitiesState.loading} monthLabel={label} onChanged={refreshFinancials} onReview={() => { setShowInsights(false); setShowBankReview(true) }} onClose={() => setShowInsights(false)} /></Modal>}
    <main className="relative mx-auto w-full max-w-6xl">
      {/* 72rem centered content + 18rem rail + 1.5rem gutter + 1.25rem safe edge = 113.5rem / 1816px. */}
      <aside aria-label="Cash flow insights" className="hidden min-[1816px]:absolute min-[1816px]:top-0 min-[1816px]:right-[calc(100%+1.5rem)] min-[1816px]:block min-[1816px]:max-h-[calc(100vh-3rem)] min-[1816px]:w-72 min-[1816px]:overflow-y-auto">{insights}</aside>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-ledger-primary">Cash Flow</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-ledger-text">Monthly overview</h1><div className="mt-3 inline-flex items-center rounded-[var(--ledger-radius-control)] border border-ledger-border bg-ledger-elevated p-1 shadow-sm" aria-label="Month navigation"><Button type="button" variant="ghost" size="sm" onClick={() => navigateMonth(-1)} aria-label="Previous month">←</Button><span className="min-w-36 px-2 text-center text-sm font-medium text-ledger-text">{label}</span><Button type="button" variant="ghost" size="sm" onClick={() => navigateMonth(1)} aria-label="Next month">→</Button></div></div>
        <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => setShowInsights(true)} aria-expanded={showInsights} className="min-[1816px]:hidden">Insights</Button><CashFlowActionsMenu year={year} month={month} onManageCategories={() => setShowCategories(true)} onWeeklyExpenses={() => setShowWeeklyExpenses(true)} /><Button type="button" onClick={() => setShowCreate(true)}>Add transaction</Button></div>
      </div>
      <div className="min-w-0">
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        {summaryState.summary && <CurrencyConversionNotice summary={summaryState.summary} />}
        {summaryState.summary?.recurringIncomeCount ? <Alert tone="success" className="mb-4">Includes {summaryState.summary.recurringIncomeCount} scheduled income {summaryState.summary.recurringIncomeCount === 1 ? 'entry' : 'entries'} from Monthly Routine. These entries map automatically to every covered month without creating manual transactions.</Alert> : null}
        <CashFlowSummaryCards summary={summaryState.summary} loading={summaryState.loading} currency={currency} />
        <div className="mt-5 space-y-5"><TransactionList transactions={transactionsState.transactions} recurringIncomes={summaryState.summary?.recurringIncomes ?? []} recurringExpenses={summaryState.summary?.recurringExpenses ?? []} loading={transactionsState.loading || summaryState.loading} monthLabel={label} onAdd={() => setShowCreate(true)} onEdit={setEditing} onDelete={setPendingDelete} /><SePayCategorizationRuleCard categories={categoriesState.categories} /></div>
      </div>
    </main>
    {showCreate && <TransactionFormDialog currency={currency} categories={categoriesState.categories} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
    {editing && <TransactionFormDialog currency={currency} categories={categoriesState.categories} transaction={editing} onClose={() => setEditing(null)} onSubmit={handleUpdate} />}
    {pendingDelete && <DeleteTransactionDialog transaction={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={async () => { await deleteTransaction(pendingDelete.id); await refreshFinancials(); setPendingDelete(null) }} />}
    {showCategories && <CategoryManagerDialog categories={categoriesState.categories} onClose={() => setShowCategories(false)} onChanged={categoriesState.reload} />}
    {showWeeklyExpenses && <WeeklyExpenseDialog currency={currency} categories={categoriesState.categories} year={year} month={month} monthLabel={label} onClose={() => setShowWeeklyExpenses(false)} onSubmit={handleWeeklyExpenses} />}
    {showBankReview && <BankActivityReviewDialog activities={bankActivitiesState.activities} categories={categoriesState.categories} loading={bankActivitiesState.loading} monthLabel={label} onClose={() => setShowBankReview(false)} onChanged={refreshFinancials} />}
  </section>
}
