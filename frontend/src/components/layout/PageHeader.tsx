import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: ReactNode
  breadcrumb?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}

export function PageHeader({ eyebrow, title, description, breadcrumb, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-2 text-sm text-ledger-text-secondary">{breadcrumb}</div>}
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ledger-primary">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ledger-text sm:text-3xl">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm text-ledger-text-secondary">{description}</div>}
        {meta && <div className="mt-3">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
