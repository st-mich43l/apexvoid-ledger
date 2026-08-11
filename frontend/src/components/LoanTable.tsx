import type { Loan } from '../types'

interface LoanTableProps {
  loans: Loan[]
  onDelete: (id: string) => void
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function LoanTable({ loans, onDelete }: LoanTableProps) {
  if (loans.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        No loans yet. Add one above to start tracking it.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-neutral-800 dark:shadow-none">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            <Th>Bank</Th>
            <Th>Open date</Th>
            <Th align="right">Disbursed</Th>
            <Th align="right">Rate / yr</Th>
            <Th align="right">Days elapsed</Th>
            <Th align="right">Accrued interest</Th>
            <Th align="right">Current balance</Th>
            <Th align="right">Monthly interest</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
          {loans.map((loan) => (
            <tr key={loan.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
              <Td className="font-medium text-neutral-900 dark:text-neutral-50">{loan.bankName}</Td>
              <Td>{dateFormatter.format(new Date(loan.openDate))}</Td>
              <Td align="right">{currencyFormatter.format(loan.disbursementAmount)}</Td>
              <Td align="right">{loan.interestRatePerYear.toFixed(2)}%</Td>
              <Td align="right">{loan.daysElapsed}</Td>
              <Td align="right">{currencyFormatter.format(loan.accruedInterest)}</Td>
              <Td align="right" className="font-semibold text-violet-600 dark:text-violet-400">
                {currencyFormatter.format(loan.currentBalance)}
              </Td>
              <Td align="right">{currencyFormatter.format(loan.monthlyInterest)}</Td>
              <Td align="right">
                <button
                  onClick={() => onDelete(loan.id)}
                  className="text-sm text-neutral-400 transition-colors hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  )
}
