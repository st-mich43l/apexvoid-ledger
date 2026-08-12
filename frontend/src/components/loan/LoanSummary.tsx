import { formatDate } from '../../lib/date'
import { formatCurrency } from '../../lib/currency'
import type { LoanDetail } from '../../types'

interface LoanSummaryProps {
  detail: LoanDetail
  onEdit: () => void
  onDelete: () => void
}

export function LoanSummary({ detail, onEdit, onDelete }: LoanSummaryProps) {
  const monthlyPaymentLabel = detail.loanType === 'unsecured' ? 'Monthly payment' : 'Est. monthly interest'

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {detail.bankName}
            </h1>
            {detail.loanType === 'secured' ? (
              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                Secured
              </span>
            ) : (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                Unsecured
              </span>
            )}
            {detail.isMatured && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                Matured
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {formatCurrency(detail.disbursementAmount, detail.currency)} · {detail.interestRatePerYear.toFixed(2)}% / yr ·{' '}
            {detail.durationMonths} month term
          </p>
        </div>

        <div className="text-right">
          <div className="mb-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:border-neutral-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Delete
            </button>
          </div>
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Estimated outstanding
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-violet-600 dark:text-violet-400">
            {formatCurrency(detail.estimatedOutstandingBalance, detail.currency)}
          </p>
        </div>
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-neutral-100 pt-6 sm:grid-cols-3 lg:grid-cols-6 dark:border-neutral-800">
        <Fact label="Open date" value={formatDate(detail.openDate)} />
        <Fact label="Maturity date" value={formatDate(detail.maturityDate)} />
        <Fact label="Term" value={`${detail.durationMonths} mo`} />
        <Fact label="Terms elapsed" value={String(detail.termsElapsed)} />
        <Fact label="Terms remaining" value={String(detail.termsRemaining)} />
        <Fact label={monthlyPaymentLabel} value={formatCurrency(detail.monthlyPayment, detail.currency)} />
      </dl>

      <p className="relative mt-6 text-xs text-neutral-400 dark:text-neutral-500">
        Calculated from the contractual loan schedule, assuming installments are paid on each due date.
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{value}</dd>
    </div>
  )
}
