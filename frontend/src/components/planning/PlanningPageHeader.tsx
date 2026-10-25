import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { buttonClassName } from '../ui/buttonStyles'

type PlanningStage = 'routine' | 'budget' | 'close'

interface PlanningPageHeaderProps {
  stage: PlanningStage
  eyebrow: string
  title: string
  description: string
  year: number
  month: number
  monthLabel: string
  onNavigateMonth: (offset: number) => void
  children?: React.ReactNode
}

const stageLabels: Record<PlanningStage, string> = { routine: 'Routine', budget: 'Budget', close: 'Month Close' }

export function PlanningPageHeader({ stage, eyebrow, title, description, year, month, monthLabel, onNavigateMonth, children }: PlanningPageHeaderProps) {
  const query = `year=${year}&month=${month}`
  return <header className="mb-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-ledger-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-ledger-text">{title}</h1><p className="mt-2 text-sm leading-6 text-ledger-text-secondary">{description}</p></div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
    <div className="mt-4 flex flex-col gap-3 border-y border-ledger-border py-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Monthly planning sections" className="flex min-w-0 overflow-x-auto">
        {(['routine', 'budget', 'close'] as const).map((item) => <Link key={item} to={`/${item === 'routine' ? 'monthly-routine' : item === 'budget' ? 'budget' : 'monthly-close'}?${query}`} aria-current={stage === item ? 'page' : undefined} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${stage === item ? 'border-ledger-primary text-ledger-primary' : 'border-transparent text-ledger-text-secondary hover:text-ledger-text'}`}>{stageLabels[item]}</Link>)}
      </nav>
      <div className="inline-flex shrink-0 items-center self-start rounded-[var(--ledger-radius-control)] border border-ledger-border bg-ledger-elevated p-1 shadow-sm sm:self-auto" aria-label="Reporting period">
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigateMonth(-1)} aria-label="Previous month">←</Button>
        <span className="min-w-36 px-2 text-center text-sm font-semibold text-ledger-text">{monthLabel}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigateMonth(1)} aria-label="Next month">→</Button>
      </div>
    </div>
  </header>
}

export function PlanningLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className={buttonClassName({ variant: 'outline', size: 'sm' })}>{children}</Link>
}
