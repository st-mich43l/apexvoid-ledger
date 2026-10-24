import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '../ui/Button'
import { cn } from '../ui/utils'
import { CurrencySelector } from '../CurrencySelector'
import { ThemeToggle } from '../ThemeToggle'
import { isNavigationGroup, navigationDestination, primaryNavigation } from './navigation'

interface MobileNavigationProps { open: boolean; onClose: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function MobileNavigation({ open, onClose, theme, onToggleTheme }: MobileNavigationProps) {
  const { pathname, search } = useLocation()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Application navigation">
      <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onClose} />
      <nav ref={drawerRef} aria-label="Mobile primary navigation" className="relative flex h-full w-[min(21rem,calc(100vw-1.5rem))] flex-col overflow-y-auto border-r border-ledger-border bg-ledger-elevated p-4 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-ledger-text">Navigate Ledger</p>
          <Button ref={closeButtonRef} type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="mb-4 flex items-center gap-2 border-b border-ledger-border pb-4 sm:hidden">
          <CurrencySelector />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <ul className="space-y-1">
          {primaryNavigation.map((item) => isNavigationGroup(item) ? (
            <li key={item.label} className="pt-3 first:pt-0">
              <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ledger-muted">{item.label}</p>
              <ul className="space-y-1">
                {item.items.map((child) => <li key={child.to}><Link to={navigationDestination(child, item, search)} onClick={onClose} aria-current={child.matches(pathname) ? 'page' : undefined} className={mobileItemClassName(child.matches(pathname))}>{child.label}{child.matches(pathname) && <span className="text-xs">Current</span>}</Link></li>)}
              </ul>
            </li>
          ) : <li key={item.to}><Link to={item.to} onClick={onClose} aria-current={item.matches(pathname) ? 'page' : undefined} className={mobileItemClassName(item.matches(pathname))}>{item.label}{item.matches(pathname) && <span className="text-xs">Current</span>}</Link></li>)}
        </ul>
      </nav>
    </div>
  )
}

function mobileItemClassName(active: boolean) {
  return cn('flex min-h-11 items-center justify-between rounded-[var(--ledger-radius-control)] px-3 text-sm font-semibold transition-colors', active ? 'bg-ledger-primary-subtle text-ledger-primary' : 'text-ledger-text-secondary hover:bg-ledger-subtle hover:text-ledger-text')
}
