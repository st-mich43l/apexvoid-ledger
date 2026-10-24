import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary, MonthlyBudgetSummary } from '../../types'
import { FinancialMetric } from '../ui/FinancialMetric'

export function FinancialMetrics({ cashFlow, budget, loading, budgetError }: { cashFlow: CashFlowMonthlySummary | null; budget: MonthlyBudgetSummary | null; loading: boolean; budgetError?: boolean }) {
  const safeToSpend = budgetError ? { value: 'Unavailable', detail: 'Budget information could not be loaded', tone: 'warning' as const } : budget?.hasBudget
    ? !budget.budgetComparisonComplete ? { value: 'Incomplete', detail: 'FX conversion is incomplete', tone: 'warning' as const }
      : budget.safeToSpend === null ? { value: 'Unavailable', detail: 'Safe-to-spend is not available', tone: 'warning' as const }
        : { value: formatCurrency(budget.safeToSpend, budget.currency), detail: budget.dailySafeToSpend === null ? 'Available after commitments' : `${formatCurrency(budget.dailySafeToSpend, budget.currency)} per remaining day`, tone: budget.safeToSpend < 0 ? 'negative' as const : 'positive' as const }
    : budget ? { value: 'Not planned', detail: 'Create a monthly budget to calculate this', tone: 'default' as const } : { value: 'Unavailable', detail: 'Budget information is unavailable', tone: 'warning' as const }
  return <section aria-labelledby="dashboard-metrics"><div className="mb-3 flex items-baseline justify-between"><h2 id="dashboard-metrics" className="text-lg font-semibold text-ledger-text">This month</h2><p className="text-sm text-ledger-text-secondary">Recorded Cash Flow and available budget context</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <FinancialMetric label="Monthly income" value={cashFlow ? formatCurrency(cashFlow.income, cashFlow.currency) : 'Unavailable'} detail={cashFlow?.recurringIncomeCount ? `Includes ${cashFlow.recurringIncomeCount} scheduled income entr${cashFlow.recurringIncomeCount === 1 ? 'y' : 'ies'}` : 'Recorded this month'} tone="positive" loading={loading} />
    <FinancialMetric label="Monthly expenses" value={cashFlow ? formatCurrency(cashFlow.expenses, cashFlow.currency) : 'Unavailable'} detail={cashFlow?.fixedExpenseCount ? 'Includes scheduled and recorded expenses' : 'Recorded this month'} loading={loading} />
    <FinancialMetric label="Net cash flow" value={cashFlow ? `${cashFlow.netCashFlow > 0 ? '+' : ''}${formatCurrency(cashFlow.netCashFlow, cashFlow.currency)}` : 'Unavailable'} detail={cashFlow ? (cashFlow.netCashFlow >= 0 ? 'Available after expenses' : 'Spending exceeds income') : 'Monthly position is unavailable'} tone={cashFlow && cashFlow.netCashFlow < 0 ? 'negative' : 'primary'} loading={loading} />
    <FinancialMetric label="Safe to spend" value={safeToSpend.value} detail={safeToSpend.detail} tone={safeToSpend.tone} loading={loading} />
  </div></section>
}
