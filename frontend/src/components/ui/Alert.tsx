import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'
type AlertTone = 'info' | 'success' | 'warning' | 'danger'
const tones: Record<AlertTone, string> = {
  info: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/35 dark:text-cyan-100', success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-100', warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100', danger: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-100',
}
export function Alert({ tone = 'info', title, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; title?: string; children: ReactNode }) {
  return <div {...props} role="alert" className={cn('rounded-[var(--ledger-radius-control)] border px-4 py-3 text-sm', tones[tone], className)}>{title && <p className="font-semibold">{title}</p>}<div className={title ? 'mt-1' : undefined}>{children}</div></div>
}
