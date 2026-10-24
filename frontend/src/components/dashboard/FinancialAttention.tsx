import { Link } from 'react-router-dom'
import type { FinancialAttentionItem } from './financialAttention'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export function FinancialAttention({ items, loading = false, incomplete = false }: { items: FinancialAttentionItem[]; loading?: boolean; incomplete?: boolean }) {
  return <Card className="h-full" aria-labelledby="financial-attention"><div className="flex items-start justify-between gap-3"><div><h2 id="financial-attention" className="text-lg font-semibold text-ledger-text">Financial Attention</h2><p className="mt-1 text-sm text-ledger-text-secondary">Conditions that need a decision or review.</p></div>{items.length > 0 && <Badge tone="warning">{items.length} to review</Badge>}</div>
    {loading ? <p className="mt-5 text-sm text-ledger-text-secondary">Checking current conditions…</p> : incomplete ? <p className="mt-5 text-sm text-ledger-text-secondary">Some conditions could not be checked. Review the available dashboard sections for details.</p> : items.length === 0 ? <div className="mt-5 rounded-[var(--ledger-radius-control)] bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"><span className="font-semibold">All clear.</span> No current dashboard condition needs action.</div> : <ul className="mt-4 divide-y divide-ledger-border">{items.map((item) => <li key={item.id}><Link to={item.to} className="flex gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"><Badge tone={item.tone}>{item.tone === 'danger' ? 'Action' : item.tone === 'warning' ? 'Review' : 'Info'}</Badge><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ledger-text">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-ledger-text-secondary">{item.detail}</span></span><span aria-hidden="true" className="text-ledger-primary">→</span></Link></li>)}</ul>}
  </Card>
}
