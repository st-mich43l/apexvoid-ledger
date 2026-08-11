import type { Loan } from '../types'

interface SummaryStatsProps {
  loans: Loan[]
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function SummaryStats({ loans }: SummaryStatsProps) {
  const totalDisbursed = loans.reduce((sum, loan) => sum + loan.disbursementAmount, 0)
  const totalAccruedInterest = loans.reduce((sum, loan) => sum + loan.accruedInterest, 0)
  const totalCurrentBalance = loans.reduce((sum, loan) => sum + loan.currentBalance, 0)

  const stats = [
    { label: 'Loans', value: String(loans.length) },
    { label: 'Total disbursed', value: currencyFormatter.format(totalDisbursed) },
    { label: 'Total accrued interest', value: currencyFormatter.format(totalAccruedInterest) },
    { label: 'Total current balance', value: currencyFormatter.format(totalCurrentBalance) },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
