import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/currency'
import type { CashFlowMonthlySummary, NetWorthSummary } from '../../types'
import type { FinancialAttentionItem } from './financialAttention'
import { MoneyPrivacyToggle } from '../MoneyPrivacyToggle'

export function MobileDashboard({ netWorth, cashFlow, attention, loading, incomplete }: { netWorth: NetWorthSummary | null; cashFlow: CashFlowMonthlySummary | null; attention: FinancialAttentionItem[]; loading: boolean; incomplete: boolean }) {
  const money = (value: number | null | undefined, currency: string) => value == null ? 'Unavailable' : formatCurrency(value, currency)
  return <div className="space-y-5 sm:hidden">
    <section aria-label="Financial position" className="rounded-2xl border border-violet-200 bg-ledger-primary-subtle p-4 dark:border-violet-900">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-widest text-ledger-primary">Financial position</p><Link to="/net-worth" className="text-sm font-semibold text-ledger-primary">Details →</Link></div>
      <p className="mt-3 text-sm text-ledger-text-secondary">Verified bank assets</p>
      <div className="mt-1 flex min-w-0 items-center gap-2"><p className="financial-amount min-w-0 text-3xl font-semibold tracking-tight text-ledger-text">{loading ? '…' : money(netWorth?.totalAssets, netWorth?.reportingCurrency ?? 'VND')}</p><MoneyPrivacyToggle context="Financial position" /></div>
      {netWorth && !netWorth.valuationComplete && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Valuation incomplete</p>}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-violet-200 pt-3 text-sm dark:border-violet-900">
        <Metric label="Income" value={money(cashFlow?.income, cashFlow?.currency ?? 'VND')} />
        <Metric label="Expenses" value={money(cashFlow?.expenses, cashFlow?.currency ?? 'VND')} />
        <Metric label="Net cash flow" value={money(cashFlow?.netCashFlow, cashFlow?.currency ?? 'VND')} />
        <Metric label="Net worth" value={money(netWorth?.netWorth, netWorth?.reportingCurrency ?? 'VND')} />
      </dl>
    </section>
    <section aria-labelledby="mobile-attention"><div className="flex items-center justify-between"><h2 id="mobile-attention" className="font-semibold text-ledger-text">Needs attention</h2><span className="text-xs text-ledger-text-secondary">{attention.length} to review</span></div>
      {loading ? <p className="mt-3 text-sm text-ledger-text-secondary">Checking your finances…</p> : attention.length === 0 ? <p className="mt-3 rounded-xl bg-ledger-surface p-4 text-sm text-ledger-text-secondary">{incomplete ? 'Some conditions could not be checked.' : 'No current items need your attention.'}</p> : <ul className="mt-2 divide-y divide-ledger-border rounded-2xl border border-ledger-border bg-ledger-surface px-4">{attention.map(item => <li key={item.id}><Link to={item.to} className="flex min-h-14 items-center gap-3 py-3"><span aria-hidden="true" className="text-ledger-primary">●</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ledger-text">{item.title}</span><span className="mt-0.5 block text-xs text-ledger-text-secondary">{item.detail}</span></span><span className="text-ledger-primary">→</span></Link></li>)}</ul>}
    </section>
    <section aria-labelledby="mobile-spending" className="rounded-2xl border border-ledger-border bg-ledger-surface p-4"><div className="flex items-center justify-between gap-2"><h2 id="mobile-spending" className="font-semibold text-ledger-text">Spending this month</h2><Link to="/cashflow" className="text-sm font-semibold text-ledger-primary">View all →</Link></div>
      {cashFlow?.categoryBreakdown.length ? <ul className="mt-3 space-y-3">{cashFlow.categoryBreakdown.slice(0, 3).map(item => <li key={item.categoryId}><div className="flex justify-between gap-2 text-sm"><span className="min-w-0 break-words text-ledger-text">{item.icon} {item.name}</span><span className="financial-amount text-right font-medium text-ledger-text">{money(item.amount, cashFlow.currency)}</span></div><div className="mt-1 h-1.5 rounded-full bg-ledger-subtle"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(item.percent, 100))}%` }} /></div></li>)}</ul> : <p className="mt-3 text-sm text-ledger-text-secondary">No spending breakdown available for this month.</p>}
    </section>
  </div>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-ledger-text-secondary">{label}</dt><dd className="financial-amount mt-1 font-semibold text-ledger-text">{value}</dd></div> }
