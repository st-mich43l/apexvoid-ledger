import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api'
import { Modal } from '../components/Modal'
import { useMonthlyClose } from '../hooks/useMonthlyClose'
import { formatCurrency } from '../lib/currency'
import type { CurrencyCode } from '../lib/currency'
import type {
  MonthlyCloseCurrent,
  MonthlyCloseDifference,
  MonthlyCloseSnapshot,
  MonthlyCloseStatus,
  MonthlyCloseSummary,
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

function formatClosedAt(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

const STATUS_COPY: Record<MonthlyCloseStatus, string> = {
  in_progress: 'In progress',
  ready_to_close: 'Ready to close',
  blocked: 'Blocked',
  closed: 'Closed',
  needs_review: 'Needs review',
}

function statusClasses(status: MonthlyCloseStatus): string {
  if (status === 'closed') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200'
  if (status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200'
  if (status === 'blocked') return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200'
  if (status === 'ready_to_close') return 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-200'
  return 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
}

function money(amount: number | null | undefined, currency: CurrencyCode | null | undefined): string {
  if (amount === null || amount === undefined || !currency) return '—'
  return formatCurrency(amount, currency)
}

function Line({ label, amount, currency }: { label: string; amount: number | null | undefined; currency: CurrencyCode | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">{money(amount, currency)}</span>
    </div>
  )
}

export function MonthlyClosePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { year, month } = useMemo(() => selectedMonth(searchParams), [searchParams])
  const closeState = useMonthlyClose(year, month)
  const [showClose, setShowClose] = useState(false)
  const [showReclose, setShowReclose] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const label = monthName(year, month)
  const summary = closeState.summary

  function navigateMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1))
    setSearchParams({ year: String(next.getUTCFullYear()), month: String(next.getUTCMonth() + 1) })
  }

  async function handleClose() {
    setSubmitting(true)
    setActionError(null)
    try {
      await closeState.close(note.trim() || undefined)
      setShowClose(false)
      setNote('')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Could not close this month.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReclose() {
    setSubmitting(true)
    setActionError(null)
    try {
      await closeState.reclose(reason)
      setShowReclose(false)
      setReason('')
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Could not re-close this month.')
    } finally {
      setSubmitting(false)
    }
  }

  const error = closeState.error || actionError
  const current = summary?.current
  const reporting = current?.reportingCurrency

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Monthly Close</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Month-end review</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            Review the final financial result and keep an auditable checkpoint for completed months.
          </p>
          <div className="mt-3 inline-flex items-center rounded-full border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <button type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">←</button>
            <span className="min-w-36 px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
            <button type="button" onClick={() => navigateMonth(1)} aria-label="Next month" className="rounded-full px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">→</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/cashflow?year=${year}&month=${month}`} className="text-sm font-medium text-neutral-600 hover:text-violet-600 dark:text-neutral-300 dark:hover:text-violet-400">Cash Flow</Link>
          <Link to={`/budget?year=${year}&month=${month}`} className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400">Budget →</Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      {closeState.loading || !summary || !current || !reporting ? (
        <p className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">Loading monthly close…</p>
      ) : (
        <CloseBody
          summary={summary}
          current={current}
          reporting={reporting}
          label={label}
          year={year}
          month={month}
          onClose={() => { setActionError(null); setShowClose(true) }}
          onReclose={() => { setActionError(null); setShowReclose(true) }}
        />
      )}

      {showClose && summary && (
        <Modal label={`Close ${label}`} onClose={() => !submitting && setShowClose(false)} dismissible={!submitting}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Close {label}?</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            This stores an auditable snapshot of the current financial result. Closing does not lock historical transactions. If {monthName(year, month).split(' ')[0]} data changes later, Ledger will mark the month as needing review.
          </p>
          <label className="mt-5 block text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="close-note">Close note (optional)</label>
          <textarea id="close-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100" rows={3} />
          {actionError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">{actionError}</p>}
          <div className="mt-7 flex justify-end gap-3">
            <button type="button" onClick={() => setShowClose(false)} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
            <button type="button" onClick={handleClose} disabled={submitting} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">{submitting ? 'Closing…' : 'Close month'}</button>
          </div>
        </Modal>
      )}

      {showReclose && summary && (
        <Modal label={`Re-close ${label}`} onClose={() => !submitting && setShowReclose(false)} dismissible={!submitting}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Re-close {label}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            The previous close remains in history. Revision {(summary.latestSnapshot?.revisionNumber ?? 1) + 1} will become the official checkpoint.
          </p>
          <label className="mt-5 block text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="reclose-reason">Reason for update</label>
          <textarea id="reclose-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} required data-autofocus className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100" rows={3} />
          {actionError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">{actionError}</p>}
          <div className="mt-7 flex justify-end gap-3">
            <button type="button" onClick={() => setShowReclose(false)} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
            <button type="button" onClick={handleReclose} disabled={submitting || reason.trim().length === 0} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">{submitting ? 'Saving…' : `Create Revision ${(summary.latestSnapshot?.revisionNumber ?? 1) + 1}`}</button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function CloseBody({
  summary,
  current,
  reporting,
  label,
  year,
  month,
  onClose,
  onReclose,
}: {
  summary: MonthlyCloseSummary
  current: MonthlyCloseCurrent
  reporting: CurrencyCode
  label: string
  year: number
  month: number
  onClose: () => void
  onReclose: () => void
}) {
  const snapshot = summary.latestSnapshot
  const lastDay = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${summary.lastDay}T00:00:00Z`))
  const budgetCurrency = current.budgetCurrency
  const potCurrency = current.savingPotCurrency

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border px-5 py-4 ${statusClasses(summary.status)}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em]">{STATUS_COPY[summary.status]}</p>
        {summary.status === 'in_progress' && (
          <p className="mt-2 text-sm leading-6">
            {label} is still in progress. Final close becomes available after {lastDay}.
          </p>
        )}
        {summary.status === 'ready_to_close' && (
          <p className="mt-2 text-sm leading-6">This month has ended. Review the result, then store an auditable snapshot.</p>
        )}
        {summary.status === 'blocked' && summary.blockers.map((item) => (
          <p key={item} className="mt-2 text-sm leading-6">{item}</p>
        ))}
        {summary.status === 'closed' && snapshot && (
          <p className="mt-2 text-sm leading-6">
            {label} closed. Revision {snapshot.revisionNumber} · {formatClosedAt(snapshot.closedAt)}. No financial changes have been detected since this close.
          </p>
        )}
        {summary.status === 'needs_review' && snapshot && (
          <p className="mt-2 text-sm leading-6">
            {label} needs review. Financial data changed after Revision {snapshot.revisionNumber}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Income" value={money(current.incomeTotal, reporting)} />
        <SummaryCard title="Expenses" value={money(-current.expenseTotal, reporting)} />
        <SummaryCard title="Net cash flow" value={money(current.netCashFlow, reporting)} tone={current.netCashFlow < 0 ? 'negative' : 'positive'} />
        <SummaryCard
          title="Budget result"
          value={
            current.hasBudget && current.safeToSpend !== null && budgetCurrency
              ? `${money(Math.abs(current.safeToSpend), budgetCurrency)} ${current.safeToSpend < 0 ? 'over' : 'under'}`
              : current.hasBudget ? 'Incomplete' : 'No budget'
          }
        />
      </div>

      {summary.status === 'in_progress' && (
        <div className="flex flex-wrap gap-3">
          <Link to={`/cashflow?year=${year}&month=${month}`} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">View Cash Flow</Link>
          <Link to={`/budget?year=${year}&month=${month}`} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">View Budget</Link>
        </div>
      )}

      {summary.hasDrift && summary.differences.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-white p-5 dark:border-amber-900/70 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">What changed</h3>
          <ul className="mt-3 space-y-3">
            {summary.differences.map((diff) => (
              <DifferenceRow key={diff.field} diff={diff} />
            ))}
          </ul>
        </section>
      )}

      <ReviewCard title="Month result">
        <Line label="Income" amount={current.incomeTotal} currency={reporting} />
        <Line label="Expenses" amount={-current.expenseTotal} currency={reporting} />
        <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <Line label={current.netCashFlow < 0 ? 'Deficit' : 'Net cash flow'} amount={current.netCashFlow < 0 ? Math.abs(current.netCashFlow) : current.netCashFlow} currency={reporting} />
        </div>
      </ReviewCard>

      <ReviewCard title="Income">
        <Line label="Scheduled income" amount={current.scheduledIncomeTotal} currency={reporting} />
        <Line label="Manual / additional income" amount={current.manualIncomeTotal} currency={reporting} />
        <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <Line label="Total" amount={current.incomeTotal} currency={reporting} />
        </div>
      </ReviewCard>

      <ReviewCard title="Expenses">
        <Line label="Fixed commitments" amount={current.fixedExpenseTotal} currency={reporting} />
        <Line label="Variable spending" amount={current.variableExpenseTotal} currency={reporting} />
        <Line label="Loan obligations" amount={current.loanPaymentTotal} currency={reporting} />
        <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <Line label="Total" amount={current.expenseTotal} currency={reporting} />
        </div>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">Loan installments are contractual schedule projections, not payment-completion records.</p>
      </ReviewCard>

      <ReviewCard title="Budget">
        {!current.hasBudget ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No monthly budget was configured.</p>
        ) : (
          <>
            <Line label="Planned variable budget" amount={current.plannedVariableBudgetTotal} currency={budgetCurrency} />
            <Line label="Actual variable spending" amount={current.budgetActualVariableExpenseTotal} currency={budgetCurrency} />
            <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <Line
                label={current.safeToSpend !== null && current.safeToSpend < 0 ? 'Over budget' : 'Under budget'}
                amount={current.safeToSpend === null ? null : Math.abs(current.safeToSpend)}
                currency={budgetCurrency}
              />
            </div>
            <Line label="Unbudgeted spending" amount={current.unbudgetedSpendTotal} currency={budgetCurrency} />
            {current.plannedSavingsAmount !== null && (
              <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Savings target</p>
                <Line label="Planned" amount={current.plannedSavingsAmount} currency={budgetCurrency} />
                <Line label="Net cash flow" amount={current.netCashFlow} currency={reporting} />
                {current.savingsTargetVariance !== null && (
                  <Line
                    label={current.savingsTargetVariance < 0 ? 'Below target' : 'Above target'}
                    amount={Math.abs(current.savingsTargetVariance)}
                    currency={reporting}
                  />
                )}
              </div>
            )}
          </>
        )}
      </ReviewCard>

      <ReviewCard title="Saving Pot">
        {current.savingPotStatus === 'not_configured' && <p className="text-sm text-neutral-500 dark:text-neutral-400">No Saving Pot configured.</p>}
        {current.savingPotStatus === 'not_applicable' && <p className="text-sm text-neutral-500 dark:text-neutral-400">Saving Pot was created after this month.</p>}
        {current.savingPotStatus !== 'not_configured' && current.savingPotStatus !== 'not_applicable' && (
          <>
            <Line label={`${monthName(year, month).split(' ')[0]} Cash Flow application`} amount={current.savingPotMonthAppliedAmount} currency={potCurrency} />
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
              Status: {current.savingPotStatus === 'synced' ? 'Synced' : current.savingPotStatus === 'blocked' ? 'Blocked' : current.savingPotStatus === 'stale' ? 'Needs sync' : 'Missing'}
            </p>
          </>
        )}
      </ReviewCard>

      {summary.closeEligible && (
        <button type="button" onClick={onClose} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500">
          Close {monthName(year, month).split(' ')[0]}
        </button>
      )}
      {summary.recloseEligible && (
        <button type="button" onClick={onReclose} className="rounded-full bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-500">
          Re-close with updated numbers
        </button>
      )}

      {summary.history.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Close history</h3>
          <div className="mt-3 grid gap-3">
            {summary.history.map((item) => (
              <HistoryCard key={item.id} snapshot={item} reporting={item.reportingCurrency} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Closing a month does not lock historical data. Transaction edits stay available on Cash Flow.
      </p>
    </div>
  )
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone?: 'positive' | 'negative' }) {
  const color = tone === 'negative' ? 'text-rose-600 dark:text-rose-400' : tone === 'positive' ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-900 dark:text-neutral-50'
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className={`mt-2 break-all text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DifferenceRow({ diff }: { diff: MonthlyCloseDifference }) {
  if (diff.previousAmount === null || diff.currentAmount === null || !diff.currency) {
    return <li className="text-sm text-neutral-700 dark:text-neutral-200">{diff.label} changed after the latest close.</li>
  }
  return (
    <li className="text-sm text-neutral-700 dark:text-neutral-200">
      <span className="font-medium">{diff.label}</span>
      <span className="mt-1 block break-all tabular-nums">
        {formatCurrency(diff.previousAmount, diff.currency)} → {formatCurrency(diff.currentAmount, diff.currency)}
      </span>
    </li>
  )
}

function HistoryCard({ snapshot, reporting }: { snapshot: MonthlyCloseSnapshot; reporting: CurrencyCode }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Revision {snapshot.revisionNumber}</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{formatClosedAt(snapshot.closedAt)}</p>
      <p className="mt-2 break-all text-sm tabular-nums text-neutral-800 dark:text-neutral-200">Net cash flow {formatCurrency(snapshot.netCashFlow, reporting)}</p>
      {snapshot.note && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{snapshot.note}</p>}
    </article>
  )
}
