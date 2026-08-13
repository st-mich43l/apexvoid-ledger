import { useState } from 'react'
import { useCashFlowTrend } from '../../hooks/useCashFlowTrend'
import type { CurrencyCode } from '../../lib/currency'
import { CashFlowTrendChart } from './CashFlowTrendChart'
import { SpendingMixChart } from './SpendingMixChart'
import { cashFlowPointKey } from './chartUtils'

interface DashboardFinancialTrendsProps {
  year: number
  month: number
  currency: CurrencyCode
}

export function DashboardFinancialTrends({ year, month, currency }: DashboardFinancialTrendsProps) {
  const [range, setRange] = useState<6 | 12>(6)
  const [selectedKey, setSelectedKey] = useState(`${year}-${String(month).padStart(2, '0')}`)
  const { summary, loading, error } = useCashFlowTrend(year, month, range, currency)
  const selected = summary?.points.find((point) => cashFlowPointKey(point) === selectedKey)
    ?? summary?.points.at(-1)

  return (
    <section className="mt-10" aria-labelledby="financial-trends-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="financial-trends-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Financial trends
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Compare cash flow over time and inspect each month’s spending.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-full border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900" aria-label="Trend period">
          {([6, 12] as const).map((months) => (
            <button
              key={months}
              type="button"
              aria-pressed={range === months}
              onClick={() => setRange(months)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${range === months ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-500' : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}`}
            >
              {months} months
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      {!error && summary && summary.unconvertedCurrencies.length > 0 && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
          {summary.unconvertedCurrencies.join(', ')} could not be converted into {summary.currency}. Those values are temporarily omitted from these charts.
        </p>
      )}

      {loading ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-5" aria-label="Loading financial trends">
          <ChartSkeleton className="lg:col-span-3" />
          <ChartSkeleton className="lg:col-span-2" />
        </div>
      ) : !error && summary && selected ? (
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-5">
          <CashFlowTrendChart
            points={summary.points}
            currency={summary.currency}
            selectedKey={cashFlowPointKey(selected)}
            onSelect={(point) => setSelectedKey(cashFlowPointKey(point))}
          />
          <SpendingMixChart point={selected} allPoints={summary.points} currency={summary.currency} />
        </div>
      ) : !error ? (
        <p className="mt-5 rounded-3xl border border-dashed border-neutral-300 px-5 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          No trend data is available yet.
        </p>
      ) : null}
    </section>
  )
}

function ChartSkeleton({ className }: { className: string }) {
  return (
    <div className={`h-[28rem] animate-pulse rounded-3xl border border-neutral-200/80 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-2 h-3 w-52 rounded bg-neutral-100 dark:bg-neutral-800/70" />
      <div className="mt-8 h-72 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60" />
    </div>
  )
}
