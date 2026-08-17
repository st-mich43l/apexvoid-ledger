import { useEffect, useState } from 'react'
import { fetchUsers } from '../api'
import { PremiumCard } from '../components/PremiumCard'
import { useCurrency } from '../context/CurrencyContext'
import { useLoans } from '../hooks/useLoans'
import { formatCurrency } from '../lib/currency'
import { FinanceCalculators } from './Tools'

export function HomePage() {
  const { loans, loading: loansLoading } = useLoans()
  const { currency } = useCurrency()
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    fetchUsers()
      .then((users) => setUserCount(users.length))
      .catch(() => setUserCount(null))
  }, [])

  const totalCurrentBalance = loans.reduce((sum, loan) => sum + loan.currentBalance, 0)

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Home</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PremiumCard
          title="Admin portal"
          accent="cyan"
          value={userCount === null ? '—' : String(userCount)}
          subtitle={userCount === null ? 'Manage user access' : `${userCount === 1 ? 'account' : 'accounts'} · manage user access`}
          to="/settings/users"
          icon={<UsersIcon />}
        />

        <PremiumCard
          title="Dashboard"
          accent="violet"
          value={loansLoading ? '…' : formatCurrency(totalCurrentBalance, currency)}
          subtitle={loansLoading ? 'Loading…' : `${loans.length} ${loans.length === 1 ? 'loan' : 'loans'} · finance overview`}
          to="/dashboard"
          icon={<GridIcon />}
        />
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Tools</p>
        <h3 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Finance calculators</h3>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Quick what-if helpers. The loan calculator uses the same EMI / interest-only formulas as Loans. These tools do not create or change loan records.
        </p>
        <div className="mt-5">
          <FinanceCalculators />
        </div>
      </div>
    </section>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
