import { PremiumCard } from '../components/PremiumCard'
import { useCurrency } from '../context/CurrencyContext'
import { formatCurrency } from '../lib/currency'
import { useLoans } from '../hooks/useLoans'

export function Dashboard() {
  const { loans, loading, error } = useLoans()
  const { currency } = useCurrency()

  const totalCurrentBalance = loans.reduce((sum, loan) => sum + loan.currentBalance, 0)

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Overview</h2>
      </div>

      {error && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PremiumCard
          title="Trading account"
          accent="cyan"
          value="—"
          subtitle="Not connected yet"
          comingSoon
          icon={<TrendingUpIcon />}
        />

        <PremiumCard
          title="Assets"
          accent="emerald"
          value="—"
          subtitle="Not connected yet"
          comingSoon
          icon={<LayersIcon />}
        />

        <PremiumCard
          title="Loan"
          accent="violet"
          value={loading ? '…' : formatCurrency(totalCurrentBalance, currency)}
          subtitle={loading ? 'Loading…' : `${loans.length} ${loans.length === 1 ? 'loan' : 'loans'} · current balance`}
          to="/loan"
          icon={<BankIcon />}
        />
      </div>
    </section>
  )
}

function TrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h6v6" />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l9 5 9-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18l9 5 9-5" />
    </svg>
  )
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10 12 4l9 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9M9 10v9M15 10v9M19 10v9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  )
}
