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
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No loans yet. Add one above to start tracking it.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
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
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {loans.map((loan) => (
            <tr key={loan.id}>
              <Td>{loan.bankName}</Td>
              <Td>{dateFormatter.format(new Date(loan.openDate))}</Td>
              <Td align="right">{currencyFormatter.format(loan.disbursementAmount)}</Td>
              <Td align="right">{loan.interestRatePerYear.toFixed(2)}%</Td>
              <Td align="right">{loan.daysElapsed}</Td>
              <Td align="right">{currencyFormatter.format(loan.accruedInterest)}</Td>
              <Td align="right" className="font-semibold">
                {currencyFormatter.format(loan.currentBalance)}
              </Td>
              <Td align="right">{currencyFormatter.format(loan.monthlyInterest)}</Td>
              <Td align="right">
                <button
                  onClick={() => onDelete(loan.id)}
                  className="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
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
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${
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
      className={`whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  )
}
