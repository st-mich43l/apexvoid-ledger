import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/currency'
import type { LoanDetail } from '../../types'

interface LoanCostSummaryProps {
  detail: LoanDetail
}

export function LoanCostSummary({ detail }: LoanCostSummaryProps) {
  const { currency } = useCurrency()
  const principal = detail.disbursementAmount
  const total = detail.totalRepayment
  const principalShare = total > 0 ? (principal / total) * 100 : 100
  const interestShare = 100 - principalShare

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Total cost of the loan</h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CostFigure label="Principal" value={formatCurrency(principal, currency)} accent="text-neutral-900 dark:text-neutral-50" />
        <CostFigure
          label="Estimated interest"
          value={formatCurrency(detail.totalInterest, currency)}
          accent="text-amber-600 dark:text-amber-400"
        />
        <CostFigure
          label="Estimated total repayment"
          value={formatCurrency(total, currency)}
          accent="text-violet-600 dark:text-violet-400"
        />
      </div>

      <div
        role="img"
        aria-label={`Principal is ${principalShare.toFixed(1)}% of the total repayment, interest is ${interestShare.toFixed(1)}%`}
        className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
      >
        <div className="h-full bg-neutral-400 dark:bg-neutral-500" style={{ width: `${principalShare}%` }} />
        <div className="h-full bg-amber-500 dark:bg-amber-400" style={{ width: `${interestShare}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-400 dark:bg-neutral-500" />
          Principal · {principalShare.toFixed(1)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
          Interest · {interestShare.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function CostFigure({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${accent}`}>{value}</p>
    </div>
  )
}
