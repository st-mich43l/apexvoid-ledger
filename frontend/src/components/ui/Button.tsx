import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; children: ReactNode }
export function Button({ variant, size, loading = false, className, disabled, children, ...props }: ButtonProps) {
  return <button {...props} disabled={disabled || loading} className={buttonClassName({ variant, size, className })}>{loading && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}<span className={loading ? 'opacity-80' : undefined}>{children}</span></button>
}
