import type { HTMLAttributes } from 'react'
import { cn } from './utils'

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ledger-subtle text-ledger-text-secondary', primary: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300', success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200', danger: 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300', info: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
}

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span {...props} className={cn('inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide', tones[tone], className)} />
}
