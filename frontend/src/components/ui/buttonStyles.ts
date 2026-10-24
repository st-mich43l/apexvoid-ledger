import { cn } from './utils'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-ledger-primary bg-ledger-primary text-white shadow-sm hover:bg-ledger-primary-hover dark:text-[#19171e]',
  secondary: 'border border-ledger-border bg-ledger-elevated text-ledger-text hover:bg-ledger-subtle',
  outline: 'border border-ledger-border bg-transparent text-ledger-text hover:border-ledger-primary hover:bg-ledger-primary-subtle',
  ghost: 'border border-transparent bg-transparent text-ledger-text-secondary hover:bg-ledger-subtle hover:text-ledger-text',
  destructive: 'border border-rose-700 bg-rose-700 text-white hover:bg-rose-800 dark:border-rose-500 dark:bg-rose-500 dark:text-[#241016] dark:hover:bg-rose-400',
}
const sizeClasses: Record<ButtonSize, string> = { sm: 'min-h-8 px-3 text-xs', md: 'min-h-10 px-4 text-sm', lg: 'min-h-11 px-5 text-sm' }

export function buttonClassName({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn('inline-flex items-center justify-center gap-2 rounded-[var(--ledger-radius-control)] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55', variantClasses[variant], sizeClasses[size], className)
}
