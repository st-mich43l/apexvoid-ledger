import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useBankActivities } from '../hooks/useBankActivities'
import { useCashFlowSummary } from '../hooks/useCashFlowSummary'
import { useMonthlyBudget } from '../hooks/useMonthlyBudget'
import { useMonthlyClose } from '../hooks/useMonthlyClose'
import { useMonthlyRoutine } from '../hooks/useMonthlyRoutine'
import { useNetWorth } from '../hooks/useNetWorth'
import { useCurrency } from '../hooks/useCurrency'
import { currentReportingPeriod } from '../lib/date'
import { AccountHealth } from '../components/dashboard/AccountHealth'
import { BudgetHealth } from '../components/dashboard/BudgetHealth'
import { DashboardQuickAccess } from '../components/dashboard/DashboardQuickAccess'
import { FinancialAttention } from '../components/dashboard/FinancialAttention'
import { deriveFinancialAttention } from '../components/dashboard/financialAttention'
import { FinancialMetrics } from '../components/dashboard/FinancialMetrics'
import { FinancialOverview } from '../components/dashboard/FinancialOverview'
import { MonthlyCommitments } from '../components/dashboard/MonthlyCommitments'
import { MobileDashboard } from '../components/dashboard/MobileDashboard'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/Alert'

const DashboardFinancialTrends = lazy(() => import('../components/dashboard/DashboardFinancialTrends').then((module) => ({ default: module.DashboardFinancialTrends })))

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export function Dashboard() {
  const [showMobileInsights, setShowMobileInsights] = useState(false)
  const [desktopLayout, setDesktopLayout] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 640px)')
    const sync = () => setDesktopLayout(media.matches)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  const { currency } = useCurrency()
  const { year, month } = currentReportingPeriod()
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const cashFlow = useCashFlowSummary(year, month, currency)
  const secondaryInsightsEnabled = desktopLayout || showMobileInsights
  const budget = useMonthlyBudget(year, month, secondaryInsightsEnabled)
  const routine = useMonthlyRoutine(year, month, currency, secondaryInsightsEnabled)
  const monthlyClose = useMonthlyClose(previous.year, previous.month)
  const netWorth = useNetWorth()
  const bankActivities = useBankActivities(year, month)
  const unconvertedCurrencies = useMemo(() => [...new Set([
    ...(cashFlow.summary?.unconvertedCurrencies ?? []),
    ...(budget.summary?.unconvertedCurrencies ?? []),
    ...(routine.summary?.unconvertedCurrencies ?? []),
  ])], [cashFlow.summary, budget.summary, routine.summary])
  const attention = useMemo(() => deriveFinancialAttention({
    budget: budget.summary,
    netWorth: netWorth.summary,
    accounts: netWorth.accounts,
    activities: bankActivities.activities,
    close: monthlyClose.summary,
    unconvertedCurrencies,
  }), [bankActivities.activities, budget.summary, monthlyClose.summary, netWorth.accounts, netWorth.summary, unconvertedCurrencies])
  const loadingAttention = netWorth.loading || bankActivities.loading || monthlyClose.loading || cashFlow.loading
    || (secondaryInsightsEnabled && (budget.loading || routine.loading))
  const hasError = cashFlow.error || budget.error || routine.error || monthlyClose.error || netWorth.error || bankActivities.error
  function retryDashboard() {
    const retries = [cashFlow.reload(), monthlyClose.reload(), netWorth.reload(), bankActivities.reload()]
    if (secondaryInsightsEnabled) retries.push(budget.reload(), routine.reload())
    void Promise.all(retries)
  }

  return (
    <section>
      <PageHeader eyebrow="Financial command center" title="Overview" description={`Current position plus monthly reporting for ${monthLabel(year, month)}.`} />
      {hasError && <Alert tone="warning" className="mb-6"><span>Some dashboard information could not be refreshed. Available sections remain current to their last successful response.</span><button type="button" className="ml-2 font-semibold underline" onClick={retryDashboard}>Retry</button></Alert>}

      <MobileDashboard netWorth={netWorth.summary} cashFlow={cashFlow.summary} attention={attention} loading={loadingAttention} incomplete={Boolean(hasError) || !secondaryInsightsEnabled} />
      <div className="hidden sm:block">
      <FinancialOverview summary={netWorth.summary} accounts={netWorth.accounts} loading={netWorth.loading} />

      <div className="mt-7"><FinancialMetrics cashFlow={cashFlow.summary} budget={budget.summary} loading={cashFlow.loading || budget.loading} budgetError={Boolean(budget.error)} /></div>

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
        <FinancialAttention items={attention} loading={loadingAttention} incomplete={Boolean(hasError)} />
        <BudgetHealth summary={budget.summary} loading={budget.loading} error={Boolean(budget.error)} year={year} month={month} />
      </div>

      {desktopLayout && <Suspense fallback={<TrendLoading />}><DashboardFinancialTrends year={year} month={month} currency={currency} /></Suspense>}

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
        <MonthlyCommitments summary={routine.summary} loading={routine.loading} year={year} month={month} />
        <AccountHealth accounts={netWorth.accounts} loading={netWorth.loading} error={Boolean(netWorth.error)} />
      </div>

      <DashboardQuickAccess />
      </div>
      <details className="mt-5 sm:hidden" onToggle={(event) => setShowMobileInsights(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer rounded-xl border border-ledger-border bg-ledger-surface px-4 py-3 text-sm font-semibold text-ledger-primary">More financial insights</summary>{showMobileInsights && <><Suspense fallback={<TrendLoading />}><DashboardFinancialTrends year={year} month={month} currency={currency} /></Suspense><div className="mt-5 space-y-5"><BudgetHealth summary={budget.summary} loading={budget.loading} error={Boolean(budget.error)} year={year} month={month} /><MonthlyCommitments summary={routine.summary} loading={routine.loading} year={year} month={month} /><AccountHealth accounts={netWorth.accounts} loading={netWorth.loading} error={Boolean(netWorth.error)} /><DashboardQuickAccess /></div></>}</details>
    </section>
  )
}

function TrendLoading() {
  return <div role="status" aria-label="Loading financial trends" className="mt-5 h-40 rounded-2xl border border-ledger-border bg-ledger-surface p-4"><span className="sr-only">Loading financial trends…</span></div>
}
