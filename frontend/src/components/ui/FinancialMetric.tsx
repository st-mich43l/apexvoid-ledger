import { Card } from './Card'
import { MoneyPrivacyToggle } from '../MoneyPrivacyToggle'
import { useCardMoneyPrivacy } from '../../lib/moneyPrivacy'
import { cn } from './utils'
interface FinancialMetricProps { label: string; value: string; detail?: string; tone?: 'default' | 'positive' | 'negative' | 'warning' | 'primary'; loading?: boolean; className?: string; privacyToggle?: boolean }
const tones = { default: 'text-ledger-text', positive: 'text-emerald-700 dark:text-emerald-400', negative: 'text-rose-700 dark:text-rose-400', warning: 'text-amber-700 dark:text-amber-300', primary: 'text-ledger-primary' }
export function FinancialMetric({ label, value, detail, tone = 'default', loading, className, privacyToggle = true }: FinancialMetricProps) {
  const [hidden, setHidden] = useCardMoneyPrivacy(`${window.location.pathname}:${label}`)
  const hasAmount = /\d/.test(value)
  return <Card className={cn('flex min-h-36 flex-col justify-between', className)}><div className="flex min-w-0 items-center justify-between gap-1"><p className="min-w-0 text-xs font-semibold uppercase tracking-[0.12em] text-ledger-muted">{label}</p>{privacyToggle && <MoneyPrivacyToggle context={label} cardHidden={hidden} onCardChange={setHidden} />}</div><p className={cn('financial-amount mt-1 break-words text-2xl font-semibold tracking-tight sm:text-[1.7rem]', tones[tone])}>{loading ? '…' : privacyToggle && hidden && hasAmount ? '••••' : value}</p>{detail && <p className="mt-2 text-xs text-ledger-text-secondary">{loading ? 'Refreshing figures…' : privacyToggle && hidden && /[₫$€£¥]/.test(detail) ? 'Amount hidden' : detail}</p>}</Card>
}
