import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CurrencySelector } from './CurrencySelector'
import { ThemeToggle } from './ThemeToggle'
import { MoneyPrivacyToggle } from './MoneyPrivacyToggle'
import { BrandMark } from './BrandMark'
import { AccountMenu } from './layout/AccountMenu'
import { MobileNavigation } from './layout/MobileNavigation'
import { NotificationBell } from './layout/NotificationBell'
import { PrimaryNavigation } from './layout/PrimaryNavigation'
import { Button } from './ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const moreActive = mobileNavigationOpen || !['/dashboard', '/cashflow', '/net-worth'].includes(pathname)

  async function handleLogout() {
    try {
      setLogoutError(false)
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError(true)
    }
  }

  const homePath = user?.isAdmin ? '/home' : '/dashboard'
  return (
    <div className="min-h-screen min-h-dvh min-w-0 bg-ledger-bg">
      <header className="sticky top-0 z-30 border-b border-ledger-border bg-ledger-bg/95 backdrop-blur supports-[backdrop-filter]:bg-ledger-bg/85">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-2 px-[var(--ledger-page-gutter)] py-2">
          <Link to={homePath} aria-label="ApexVoid Ledger home" className="flex shrink-0 items-center gap-2 rounded-[var(--ledger-radius-control)] text-ledger-text transition-opacity hover:opacity-75">
            <BrandMark className="h-7 w-7" />
            <span className="hidden text-base font-semibold tracking-tight sm:inline">ApexVoid Ledger</span>
          </Link>

          <div className="min-w-0 flex-1 xl:flex xl:justify-center"><PrimaryNavigation /></div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden items-center rounded-[var(--ledger-radius-control)] border border-ledger-border bg-ledger-elevated p-0.5 shadow-sm sm:flex"><CurrencySelector /><span aria-hidden="true" className="h-4 w-px bg-ledger-border" /><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
            <div className="hidden max-sm:block"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
            <MoneyPrivacyToggle />
            {user && <NotificationBell />}
            {user && <AccountMenu user={user} onLogout={handleLogout} />}
            <div className="hidden sm:block xl:hidden"><Button type="button" variant="ghost" size="sm" aria-label="Open navigation" aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(true)} className="h-11 min-h-11 w-11 px-0">
              <MenuIcon className="h-5 w-5" />
            </Button></div>
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-7xl px-[var(--ledger-page-gutter)] pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:py-8">
        {logoutError && <p role="alert" className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">Could not safely disable this device’s notifications or log out. Check your connection and try again.</p>}
        <Outlet />
      </main>

      <nav aria-label="Mobile navigation" className="matte-glass fixed right-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-4 z-30 mx-auto max-w-md rounded-full p-1 sm:hidden">
        <div className="grid grid-cols-4 gap-0.5">
          <MobileTab to="/dashboard" label="Dashboard" icon="overview" />
          <MobileTab to="/cashflow" label="Cash Flow" icon="cashflow" />
          <MobileTab to="/net-worth" label="Net Worth" icon="wealth" />
          <button type="button" aria-label="Open navigation" aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(true)} className={`matte-nav-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full font-medium transition-colors ${moreActive ? 'bg-[var(--matte-active)] text-[var(--matte-active-text)]' : 'text-ledger-text-secondary'}`}><MobileIcon name="more" />More</button>
        </div>
      </nav>

      <MobileNavigation open={mobileNavigationOpen} onClose={() => setMobileNavigationOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
    </div>
  )
}

function MobileTab({ to, label, icon }: { to: string; label: string; icon: 'overview' | 'cashflow' | 'wealth' }) {
  return <NavLink to={to} className={({ isActive }) => `matte-nav-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full font-medium transition-colors ${isActive ? 'bg-[var(--matte-active)] text-[var(--matte-active-text)]' : 'text-ledger-text-secondary hover:bg-ledger-subtle'}`}><MobileIcon name={icon} />{label}</NavLink>
}

function MobileIcon({ name }: { name: 'overview' | 'cashflow' | 'wealth' | 'more' }) {
  const paths = { overview: 'M4 10 12 3l8 7v10h-6v-6h-4v6H4z', cashflow: 'M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4', wealth: 'M3 10 12 4l9 6M5 10v8m5-8v8m4-8v8m5-8v8M3 20h18', more: 'M5 12h.01M12 12h.01M19 12h.01' }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d={paths[name]} /></svg>
}

function MenuIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
}
