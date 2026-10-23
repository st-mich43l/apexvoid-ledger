import { useEffect, useState } from 'react'
import { fetchUsers } from '../api'
import { PremiumCard } from '../components/PremiumCard'
import { useNetWorth } from '../hooks/useNetWorth'
import { formatCurrency } from '../lib/currency'

export function HomePage() {
  const netWorth = useNetWorth()
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    fetchUsers()
      .then((users) => setUserCount(users.length))
      .catch(() => setUserCount(null))
  }, [])

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
          value={
            netWorth.loading
              ? '…'
              : netWorth.summary?.netWorth === null || netWorth.summary?.netWorth === undefined
                ? 'Incomplete'
                : formatCurrency(netWorth.summary.netWorth, netWorth.summary.reportingCurrency)
          }
          subtitle={
            netWorth.loading
              ? 'Loading net worth…'
              : netWorth.summary?.valuationComplete
                ? `${netWorth.summary.assetBreakdown.filter((line) => line.included).length} ${netWorth.summary.assetBreakdown.filter((line) => line.included).length === 1 ? 'asset' : 'assets'} · ${netWorth.summary.liabilityBreakdown.length} ${netWorth.summary.liabilityBreakdown.length === 1 ? 'liability' : 'liabilities'}`
                : 'Review connected accounts'
          }
          to="/dashboard"
          icon={<GridIcon />}
        />
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
