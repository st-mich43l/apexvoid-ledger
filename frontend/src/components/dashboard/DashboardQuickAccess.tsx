import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'

const links = [
  ['Cash Flow', '/cashflow'], ['Monthly Budget', '/budget'], ['Monthly Routine', '/monthly-routine'],
  ['Loans', '/loan'], ['Net Worth', '/net-worth'], ['Saving Pot', '/saving-pot'],
]

export function DashboardQuickAccess() {
  return <section className="mt-8" aria-labelledby="quick-access"><h2 id="quick-access" className="text-lg font-semibold text-ledger-text">Quick access</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{links.map(([label, to]) => <Link key={to} to={to}><Card variant="interactive" className="flex items-center justify-between p-4"><span className="text-sm font-semibold text-ledger-text">{label}</span><span aria-hidden="true" className="text-ledger-primary">→</span></Card></Link>)}</div></section>
}
