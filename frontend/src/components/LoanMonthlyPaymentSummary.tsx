import { useCurrency } from '../context/CurrencyContext'
import { formatCurrency } from '../lib/currency'
import { summarizeMonthlyPayments } from '../lib/loans'
import type { Loan } from '../types'

interface LoanMonthlyPaymentSummaryProps {
  loans: Loan[]
}

export function LoanMonthlyPaymentSummary({ loans }: LoanMonthlyPaymentSummaryProps) {
  const { currency: accountCurrency } = useCurrency()
  const summary = summarizeMonthlyPayments(loans)
  const activeLoanLabel = `${summary.activeLoanCount} active ${summary.activeLoanCount === 1 ? 'loan' : 'loans'}`

  return (
    <section
      aria-labelledby="monthly-loan-payments-heading"
      className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

      <div className="relative">
        <h2 id="monthly-loan-payments-heading" className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Estimated monthly loan payments
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Contractual payments across non-matured loans.
        </p>

        {summary.currencies.length <= 1 ? (
          <>
            <div className="mt-6">
              <p className="text-3xl font-semibold tracking-tight text-violet-600 sm:text-4xl dark:text-violet-400">
                {formatCurrency(summary.currencies[0]?.total ?? 0, summary.currencies[0]?.currency ?? accountCurrency)}
                <span className="ml-1.5 text-sm font-medium tracking-normal text-neutral-400 dark:text-neutral-500">/ month</span>
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{activeLoanLabel}</p>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <PaymentType label="Unsecured installments" value={formatCurrency(summary.currencies[0]?.unsecured ?? 0, summary.currencies[0]?.currency ?? accountCurrency)} accentClass="bg-violet-500" />
              <PaymentType label="Secured interest-only" value={formatCurrency(summary.currencies[0]?.secured ?? 0, summary.currencies[0]?.currency ?? accountCurrency)} accentClass="bg-cyan-500" />
            </dl>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{activeLoanLabel} across multiple currencies</p>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {summary.currencies.map((currencySummary) => (
                <PaymentType key={currencySummary.currency} label={`${currencySummary.currency} payments`} value={`${formatCurrency(currencySummary.total, currencySummary.currency)} / month`} accentClass="bg-violet-500" />
              ))}
            </dl>
          </div>
        )}

        {summary.hasActiveSecuredLoan && (
          <p className="mt-5 border-t border-neutral-100 pt-4 text-xs leading-5 text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
            Secured-loan principal due at maturity is not included.
          </p>
        )}
      </div>
    </section>
  )
}

function PaymentType({ label, value, accentClass }: { label: string; value: string; accentClass: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
      <dt className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span className={`h-2 w-2 rounded-full ${accentClass}`} />
        {label}
      </dt>
      <dd className="mt-1.5 text-base font-semibold text-neutral-900 dark:text-neutral-50">{value}</dd>
    </div>
  )
}
