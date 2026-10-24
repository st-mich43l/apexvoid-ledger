import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/currency'
import type { FinancialAccount, NetWorthSummary } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export function FinancialOverview({ summary, accounts, loading }: { summary: NetWorthSummary | null; accounts: FinancialAccount[]; loading: boolean }) {
  const netWorth = summary?.netWorth
  const connected = accounts.length
  const verified = accounts.filter((account) => account.balanceStatus === 'verified').length
  return (
    <Card variant="highlighted" className="overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-ledger-primary">Financial position</p>{!loading && summary && <Badge tone={summary.valuationComplete ? 'success' : 'warning'}>{summary.valuationComplete ? 'Valuation complete' : 'Valuation incomplete'}</Badge>}</div>
          <p className="financial-amount mt-3 break-words text-3xl font-semibold tracking-tight text-ledger-text sm:text-4xl">{loading ? '…' : !summary || netWorth === null || netWorth === undefined ? 'Incomplete' : formatCurrency(netWorth, summary.reportingCurrency)}</p>
          <p className="mt-2 text-sm text-ledger-text-secondary">{loading ? 'Loading current position…' : summary ? `Current position in ${summary.reportingCurrency}; separate from monthly Cash Flow.` : 'Current position is unavailable.'}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-7 gap-y-3 text-sm sm:min-w-80">
          <Metric label="Verified assets" value={loading ? '…' : summary?.totalAssets === null || summary?.totalAssets === undefined ? 'Unavailable' : formatCurrency(summary.totalAssets, summary.reportingCurrency)} />
          <Metric label="Liabilities" value={loading ? '…' : summary?.totalLiabilities === null || summary?.totalLiabilities === undefined ? 'Unavailable' : formatCurrency(summary.totalLiabilities, summary.reportingCurrency)} />
          <Metric label="Connected accounts" value={loading ? '…' : `${verified} of ${connected} verified`} />
          <Metric label="Updated" value={loading ? '…' : summary?.lastUpdatedAt ? formatUpdated(summary.lastUpdatedAt) : 'No update time'} />
        </dl>
      </div>
      <div className="mt-5 border-t border-violet-200/80 pt-4 dark:border-violet-900/60"><Link to="/net-worth" className="text-sm font-semibold text-ledger-primary hover:underline">View Net Worth details <span aria-hidden="true">→</span></Link></div>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-ledger-text-secondary">{label}</dt><dd className="financial-amount mt-0.5 break-words font-semibold text-ledger-text">{value}</dd></div> }
function formatUpdated(value: string) { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
