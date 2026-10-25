import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { CurrencySelector } from './CurrencySelector'
import { ThemeToggle } from './ThemeToggle'
import { BrandMark } from './BrandMark'
import { AccountMenu } from './layout/AccountMenu'
import { MobileNavigation } from './layout/MobileNavigation'
import { PrimaryNavigation } from './layout/PrimaryNavigation'
import { Button } from './ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const homePath = user?.isAdmin ? '/home' : '/dashboard'
  return (
    <div className="min-h-screen min-h-dvh bg-ledger-bg">
      <header className="sticky top-0 z-30 border-b border-ledger-border bg-ledger-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to={homePath} aria-label="ApexVoid Ledger home" className="flex shrink-0 items-center gap-2 rounded-[var(--ledger-radius-control)] text-ledger-text transition-opacity hover:opacity-75">
            <BrandMark className="h-7 w-7" />
            <span className="hidden text-base font-semibold tracking-tight sm:inline">ApexVoid Ledger</span>
          </Link>

          <div className="min-w-0 flex-1 xl:flex xl:justify-center"><PrimaryNavigation /></div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center rounded-[var(--ledger-radius-control)] border border-ledger-border bg-ledger-elevated p-0.5 shadow-sm sm:flex"><CurrencySelector /><span aria-hidden="true" className="h-4 w-px bg-ledger-border" /><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
            <div className="sm:hidden"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
            {user && <AccountMenu user={user} onLogout={handleLogout} />}
            <Button type="button" variant="ghost" size="sm" aria-label="Open navigation" aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(true)} className="h-9 min-h-9 w-9 px-0 xl:hidden">
              <MenuIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>

      <MobileNavigation open={mobileNavigationOpen} onClose={() => setMobileNavigationOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
    </div>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
}
