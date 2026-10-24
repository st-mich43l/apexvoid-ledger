import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buttonClassName } from '../ui/buttonStyles'
import { cn } from '../ui/utils'
import { isNavigationGroup, navigationDestination, primaryNavigation } from './navigation'

const itemClassName = (active: boolean) => cn(
  'inline-flex min-h-9 items-center gap-1 rounded-[var(--ledger-radius-control)] px-3 text-sm font-semibold transition-colors',
  active ? 'bg-ledger-primary-subtle text-ledger-primary' : 'text-ledger-text-secondary hover:bg-ledger-subtle hover:text-ledger-text',
)

export function PrimaryNavigation() {
  const { pathname, search } = useLocation()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const navigationRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setOpenGroup(null)
  }, [pathname])

  useEffect(() => {
    if (!openGroup) return
    function closeOnOutside(event: PointerEvent) {
      if (!navigationRef.current?.contains(event.target as Node)) setOpenGroup(null)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenGroup(null)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openGroup])

  return (
    <nav ref={navigationRef} aria-label="Primary navigation" className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {primaryNavigation.map((item) => isNavigationGroup(item) ? (
          <li key={item.label} className="relative">
            <button
              type="button"
              className={itemClassName(item.matches(pathname))}
              aria-expanded={openGroup === item.label}
              aria-haspopup="menu"
              onClick={() => setOpenGroup((current) => current === item.label ? null : item.label)}
            >
              {item.label}<ChevronDownIcon className="h-3.5 w-3.5" />
              {item.matches(pathname) && <span className="sr-only">, current section</span>}
            </button>
            {openGroup === item.label && (
              <div role="menu" aria-label={`${item.label} navigation`} className="absolute top-full left-0 z-50 mt-2 w-52 rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-elevated p-1.5 shadow-[var(--ledger-shadow-card)]">
                {item.items.map((child) => (
                  <Link key={child.to} to={navigationDestination(child, item, search)} role="menuitem" aria-current={child.matches(pathname) ? 'page' : undefined} className={buttonClassName({ variant: 'ghost', size: 'md', className: cn('w-full justify-between px-3', child.matches(pathname) && 'bg-ledger-primary-subtle text-ledger-primary') })}>
                    {child.label}{child.matches(pathname) && <span className="text-xs">Current</span>}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ) : (
          <li key={item.to}>
            <Link to={item.to} aria-current={item.matches(pathname) ? 'page' : undefined} className={itemClassName(item.matches(pathname))}>
              {item.label}{item.matches(pathname) && <span className="sr-only">, current page</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
}
