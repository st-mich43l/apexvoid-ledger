import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

type Accent = 'violet' | 'cyan' | 'emerald' | 'amber'
const accentStyles: Record<Accent, { badge: string; border: string }> = {
  violet: { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', border: 'hover:border-violet-300 dark:hover:border-violet-700' },
  cyan: { badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300', border: 'hover:border-cyan-300 dark:hover:border-cyan-700' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', border: 'hover:border-emerald-300 dark:hover:border-emerald-700' },
  amber: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', border: 'hover:border-amber-300 dark:hover:border-amber-700' },
}
interface PremiumCardProps { title: string; icon: ReactNode; accent: Accent; value: string; subtitle: string; to?: string; comingSoon?: boolean }

// Retains the dashboard-facing API while using the shared card system.
export function PremiumCard({ title, icon, accent, value, subtitle, to, comingSoon }: PremiumCardProps) {
  const styles = accentStyles[accent]
  const card = <Card variant={comingSoon ? 'subtle' : 'interactive'} className={`group h-full min-w-0 ${comingSoon ? 'opacity-80' : styles.border}`}>
    <div className="flex items-start justify-between">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[var(--ledger-radius-control)] ${styles.badge}`}>{icon}</div>
      {comingSoon ? <Badge className="border border-dashed border-ledger-border bg-transparent">Coming soon</Badge> : to && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 text-ledger-muted opacity-0 transition-opacity group-hover:opacity-100"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
    </div>
    <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-ledger-muted uppercase">{title}</p>
    <p className="financial-amount mt-1 min-w-0 break-words text-2xl font-semibold tracking-tight text-ledger-text xl:text-[clamp(1.25rem,1.8vw,1.875rem)]">{value}</p>
    <p className="mt-1 text-sm text-ledger-text-secondary">{subtitle}</p>
  </Card>
  return to && !comingSoon ? <Link to={to} className="block h-full min-w-0">{card}</Link> : card
}
