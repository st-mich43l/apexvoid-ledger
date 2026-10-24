import { useMemo } from 'react'
import { useBankActivities } from '../hooks/useBankActivities'
import { useCashFlowSummary } from '../hooks/useCashFlowSummary'
import { useMonthlyBudget } from '../hooks/useMonthlyBudget'
import { useMonthlyClose } from '../hooks/useMonthlyClose'
import { useMonthlyRoutine } from '../hooks/useMonthlyRoutine'
import { useNetWorth } from '../hooks/useNetWorth'
import { useCurrency } from '../context/CurrencyContext'
import { currentReportingPeriod } from '../lib/date'
import { AccountHealth } from '../components/dashboard/AccountHealth'
import { BudgetHealth } from '../components/dashboard/BudgetHealth'
import { DashboardFinancialTrends } from '../components/dashboard/DashboardFinancialTrends'
import { DashboardQuickAccess } from '../components/dashboard/DashboardQuickAccess'
import { FinancialAttention } from '../components/dashboard/FinancialAttention'
import { deriveFinancialAttention } from '../components/dashboard/financialAttention'
import { FinancialMetrics } from '../components/dashboard/FinancialMetrics'
import { FinancialOverview } from '../components/dashboard/FinancialOverview'
import { MonthlyCommitments } from '../components/dashboard/MonthlyCommitments'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/Alert'

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export function Dashboard() {
  const { currency } = useCurrency()
  const { year, month } = currentReportingPeriod()
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const cashFlow = useCashFlowSummary(year, month, currency)
  const budget = useMonthlyBudget(year, month)
  const routine = useMonthlyRoutine(year, month, currency)
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
  const loadingAttention = budget.loading || netWorth.loading || bankActivities.loading || monthlyClose.loading || cashFlow.loading || routine.loading
  const hasError = cashFlow.error || budget.error || routine.error || monthlyClose.error || netWorth.error || bankActivities.error

  return (
    <section>
      <PageHeader eyebrow="Financial command center" title="Overview" description={`Current position plus monthly reporting for ${monthLabel(year, month)}.`} />
      {hasError && <Alert tone="warning" className="mb-6">Some dashboard information could not be refreshed. Available sections remain current to their last successful response.</Alert>}

      <FinancialOverview summary={netWorth.summary} accounts={netWorth.accounts} loading={netWorth.loading} />

      <div className="mt-7"><FinancialMetrics cashFlow={cashFlow.summary} budget={budget.summary} loading={cashFlow.loading || budget.loading} budgetError={Boolean(budget.error)} /></div>

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
        <FinancialAttention items={attention} loading={loadingAttention} incomplete={Boolean(hasError)} />
        <BudgetHealth summary={budget.summary} loading={budget.loading} error={Boolean(budget.error)} year={year} month={month} />
      </div>

      <DashboardFinancialTrends year={year} month={month} currency={currency} />

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
        <MonthlyCommitments summary={routine.summary} loading={routine.loading} year={year} month={month} />
        <AccountHealth accounts={netWorth.accounts} loading={netWorth.loading} error={Boolean(netWorth.error)} />
      </div>

      <DashboardQuickAccess />
    </section>
  )
}
