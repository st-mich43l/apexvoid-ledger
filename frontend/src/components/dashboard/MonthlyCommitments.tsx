import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/currency'
import type { MonthlyRoutineSummary } from '../../types'
import { Card } from '../ui/Card'

export function MonthlyCommitments({ summary, loading, year, month }: { summary: MonthlyRoutineSummary | null; loading: boolean; year: number; month: number }) {
  const href = `/monthly-routine?year=${year}&month=${month}`
  if (loading) return <Card className="h-full"><p className="text-sm text-ledger-text-secondary">Loading monthly commitments…</p></Card>
  if (!summary) return <Card className="h-full"><h2 className="text-lg font-semibold text-ledger-text">Monthly commitments</h2><p className="mt-2 text-sm text-ledger-text-secondary">Monthly routine information is unavailable.</p></Card>
  const incomplete = summary.unconvertedCurrencies.length > 0
  return <Card className="h-full"><h2 className="text-lg font-semibold text-ledger-text">Monthly commitments</h2><p className="mt-1 text-sm text-ledger-text-secondary">Scheduled income and contractual costs—not proof of payment.</p>{incomplete ? <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">Totals exclude unconverted {summary.unconvertedCurrencies.join(', ')} values.</p> : <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4"><Commitment label="Expected income" value={formatCurrency(summary.expectedIncomeTotal, summary.currency)} /><Commitment label="Committed costs" value={formatCurrency(summary.committedExpenseTotal, summary.currency)} /><Commitment label="Loan obligations" value={formatCurrency(summary.loanPaymentTotal, summary.currency)} /><Commitment label="Projected available" value={formatCurrency(summary.projectedRemainder, summary.currency)} /></dl>}<Link to={href} className="mt-5 inline-flex text-sm font-semibold text-ledger-primary hover:underline">Open Monthly Routine →</Link></Card>
}
function Commitment({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-ledger-text-secondary">{label}</dt><dd className="financial-amount mt-0.5 text-sm font-semibold text-ledger-text">{value}</dd></div> }
