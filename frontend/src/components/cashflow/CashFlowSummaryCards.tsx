import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary } from '../../types'
import { FinancialMetric } from '../ui/FinancialMetric'

interface CashFlowSummaryCardsProps {
  summary: CashFlowMonthlySummary | null
  loading: boolean
  currency: string
}

export function CashFlowSummaryCards({ summary, loading, currency }: CashFlowSummaryCardsProps) {
  const cards = [
    {
      label: 'Income',
      value: summary ? formatCurrency(summary.income, currency) : '—',
      tone: 'positive' as const,
      detail: 'Recorded this month',
    },
    {
      label: 'Expenses',
      value: summary ? formatCurrency(summary.expenses, currency) : '—',
      tone: 'default' as const,
      detail: 'Recorded this month',
    },
    {
      label: 'Net cash flow',
      value: summary
        ? `${summary.netCashFlow > 0 ? '+' : ''}${formatCurrency(summary.netCashFlow, currency)}`
        : '—',
      tone:
        summary && summary.netCashFlow < 0
          ? 'warning' as const
          : 'primary' as const,
      detail: summary?.netCashFlow === undefined ? 'Loading monthly position' : summary.netCashFlow >= 0 ? 'Available after expenses' : 'Spending exceeds income',
    },
    {
      label: 'Savings rate',
      value:
        summary?.savingsRatePercent == null
          ? '—'
          : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(summary.savingsRatePercent)}%`,
      tone: 'default' as const,
      detail: summary?.savingsRatePercent == null ? 'Requires recorded income' : 'Of income retained',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <FinancialMetric key={card.label} label={card.label} value={card.value} detail={card.detail} tone={card.tone} loading={loading} />
      ))}
    </div>
  )
}
