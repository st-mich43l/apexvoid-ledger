import type { LoanDetail } from '../../types'

interface LoanProgressProps {
  detail: LoanDetail
}

export function LoanProgress({ detail }: LoanProgressProps) {
  const termsProgress =
    detail.durationMonths > 0 ? Math.min(100, (detail.termsElapsed / detail.durationMonths) * 100) : 0

  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Repayment progress</h2>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ProgressBar
          label="Terms"
          value={`${detail.termsElapsed} / ${detail.durationMonths}`}
          percent={termsProgress}
          accent="violet"
        />
        <ProgressBar
          label="Principal repaid"
          value={`${detail.principalRepaidPercent.toFixed(1)}%`}
          percent={detail.principalRepaidPercent}
          accent="emerald"
        />
      </div>
    </div>
  )
}

function ProgressBar({
  label,
  value,
  percent,
  accent,
}: {
  label: string
  value: string
  percent: number
  accent: 'violet' | 'emerald'
}) {
  const barColor = accent === 'violet' ? 'bg-violet-500 dark:bg-violet-400' : 'bg-emerald-500 dark:bg-emerald-400'
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{value}</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
