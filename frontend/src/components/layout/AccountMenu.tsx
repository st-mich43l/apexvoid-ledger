import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../../types'
import { Button } from '../ui/Button'

interface AccountMenuProps { user: AuthUser; onLogout: () => Promise<void> }

export function AccountMenu({ user, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: PointerEvent) { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <Button type="button" variant="ghost" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="min-h-8 whitespace-nowrap px-2">
        <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ledger-primary-subtle text-[10px] font-bold text-ledger-primary">{user.username.slice(0, 1).toUpperCase()}</span>
        <span className="hidden max-w-28 truncate sm:inline">{user.username}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
      </Button>
      {open && (
        <div role="menu" aria-label="Account menu" className="absolute top-full right-0 z-50 mt-2 w-56 rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-elevated p-1.5 shadow-[var(--ledger-shadow-card)]">
          <div className="border-b border-ledger-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ledger-text">{user.username}</p>
            <p className="mt-0.5 text-xs text-ledger-text-secondary">Ledger account</p>
          </div>
          <Link to="/settings/users" role="menuitem" onClick={() => setOpen(false)} className="mt-1 flex min-h-10 items-center rounded-[var(--ledger-radius-control)] px-3 text-sm font-medium text-ledger-text-secondary hover:bg-ledger-subtle hover:text-ledger-text">User account</Link>
          {user.isAdmin && <Link to="/home" role="menuitem" onClick={() => setOpen(false)} className="flex min-h-10 items-center rounded-[var(--ledger-radius-control)] px-3 text-sm font-medium text-ledger-text-secondary hover:bg-ledger-subtle hover:text-ledger-text">Administration</Link>}
          <div className="mt-1 border-t border-ledger-border pt-1">
            <button type="button" role="menuitem" onClick={() => void onLogout()} className="flex min-h-10 w-full items-center rounded-[var(--ledger-radius-control)] px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Log out</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
}
