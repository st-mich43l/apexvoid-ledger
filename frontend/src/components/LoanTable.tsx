import { useCurrency } from '../context/CurrencyContext'
import { formatCurrency } from '../lib/currency'
import type { Loan } from '../types'

interface LoanTableProps {
  loans: Loan[]
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// Remaining terms (a term = one month, same unit as the "Term (months)"
// field the loan was created with) — calendar-accurate, not
// daysRemaining / 30 which drifts. Falls back to exact days only once
// there's under a full term left, where "0 terms" would hide the
// remaining time entirely.
function formatTermRemaining(loan: Loan): string {
  const now = new Date()
  const maturity = new Date(loan.maturityDate)

  let months =
    (maturity.getUTCFullYear() - now.getUTCFullYear()) * 12 + (maturity.getUTCMonth() - now.getUTCMonth())
  if (maturity.getUTCDate() < now.getUTCDate()) months -= 1
  months = Math.max(months, 0)

  if (months === 0) return `${loan.daysRemaining}d left`
  return `${months} ${months === 1 ? 'term' : 'terms'} left`
}

export function LoanTable({ loans, onDelete }: LoanTableProps) {
  const { currency } = useCurrency()

  if (loans.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        No loans yet. Add one above to start tracking it.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-neutral-200/80 bg-white shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900/60">
          <tr>
            <Th>Bank</Th>
            <Th>Type</Th>
            <Th>Open date</Th>
            <Th>Maturity</Th>
            <Th align="right">Disbursed</Th>
            <Th align="right">Rate / yr</Th>
            <Th align="right">Accrued interest</Th>
            <Th align="right">Current balance</Th>
            <Th align="right">Monthly payment</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {loans.map((loan) => (
            <tr key={loan.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
              <Td className="font-medium text-neutral-900 dark:text-neutral-50">{loan.bankName}</Td>
              <Td>
                {loan.loanType === 'secured' ? (
                  <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                    Secured
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    Unsecured
                  </span>
                )}
              </Td>
              <Td>{formatDate(loan.openDate)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <span>{formatDate(loan.maturityDate)}</span>
                  {loan.isMatured ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      Matured
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      {formatTermRemaining(loan)}
                    </span>
                  )}
                </div>
              </Td>
              <Td align="right">{formatCurrency(loan.disbursementAmount, currency)}</Td>
              <Td align="right">{loan.interestRatePerYear.toFixed(2)}%</Td>
              <Td align="right">{formatCurrency(loan.accruedInterest, currency)}</Td>
              <Td align="right" className="font-semibold text-violet-600 dark:text-violet-400">
                {formatCurrency(loan.currentBalance, currency)}
              </Td>
              <Td align="right">{formatCurrency(loan.monthlyInterest, currency)}</Td>
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
