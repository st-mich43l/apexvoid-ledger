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
    { label: 'Total balance', value: currencyFormatter.format(totalCurrentBalance), emphasis: true },
    { label: 'Disbursed', value: currencyFormatter.format(totalDisbursed) },
    { label: 'Accrued interest', value: currencyFormatter.format(totalAccruedInterest) },
    { label: 'Loans', value: String(loans.length) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
        >
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{stat.label}</p>
          <p
            className={
              stat.emphasis
                ? 'mt-2 text-2xl font-semibold tracking-tight text-violet-600 sm:text-3xl dark:text-violet-400'
                : 'mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'
            }
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
