import type { HTMLAttributes } from 'react'
import { cn } from './utils'
type CardVariant = 'default' | 'subtle' | 'highlighted' | 'interactive'
const variants: Record<CardVariant, string> = {
  default: 'border-ledger-border bg-ledger-surface shadow-[var(--ledger-shadow-card)]',
  subtle: 'border-ledger-border bg-ledger-subtle shadow-none',
  highlighted: 'border-violet-200 bg-ledger-primary-subtle shadow-[var(--ledger-shadow-card)] dark:border-violet-900',
  interactive: 'border-ledger-border bg-ledger-surface shadow-[var(--ledger-shadow-card)] transition-colors hover:border-violet-300 hover:bg-ledger-elevated dark:hover:border-violet-700',
}
interface CardProps extends HTMLAttributes<HTMLElement> { variant?: CardVariant; padding?: 'none' | 'sm' | 'md' | 'lg' }
export function Card({ variant = 'default', padding = 'md', className, ...props }: CardProps) {
  const paddingClass = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6 sm:p-7' : 'p-5'
  return <article {...props} className={cn('rounded-[var(--ledger-radius-card)] border', variants[variant], paddingClass, className)} />
}
