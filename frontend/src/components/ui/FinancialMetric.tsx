import { Card } from './Card'
import { cn } from './utils'
interface FinancialMetricProps { label: string; value: string; detail?: string; tone?: 'default' | 'positive' | 'negative' | 'warning' | 'primary'; loading?: boolean; className?: string }
const tones = { default: 'text-ledger-text', positive: 'text-emerald-700 dark:text-emerald-400', negative: 'text-rose-700 dark:text-rose-400', warning: 'text-amber-700 dark:text-amber-300', primary: 'text-ledger-primary' }
export function FinancialMetric({ label, value, detail, tone = 'default', loading, className }: FinancialMetricProps) {
  return <Card className={cn('flex min-h-36 flex-col justify-between', className)}><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ledger-muted">{label}</p><p className={cn('financial-amount mt-3 break-words text-2xl font-semibold tracking-tight sm:text-[1.7rem]', tones[tone])}>{loading ? '…' : value}</p>{detail && <p className="mt-2 text-xs text-ledger-text-secondary">{loading ? 'Refreshing figures…' : detail}</p>}</Card>
}
