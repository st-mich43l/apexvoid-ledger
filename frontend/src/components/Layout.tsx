import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CurrencySelector } from './CurrencySelector'
import { ThemeToggle } from './ThemeToggle'
import { BrandMark } from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'

// The back link goes to the immediate parent in the nav hierarchy
// (/loan/:id -> /loan -> /dashboard -> /home for admins), not always
// straight to the top-level home base.
function getBackTarget(pathname: string, isAdmin: boolean): { path: string; label: string } | null {
  if (pathname.startsWith('/loan/')) return { path: '/loan', label: 'Loans' }
  if (pathname === '/loan') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/cashflow') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/budget') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/monthly-close') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/saving-pot') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/monthly-routine') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/net-worth') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/settings/users') return isAdmin ? { path: '/home', label: 'Home' } : { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/dashboard') return isAdmin ? { path: '/home', label: 'Home' } : null
  return null
}

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const back = getBackTarget(pathname, user?.isAdmin ?? false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen min-h-dvh bg-ledger-bg">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-8 rounded-[var(--ledger-radius-modal)] border border-ledger-border bg-ledger-surface p-5 shadow-[var(--ledger-shadow-card)] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {back && (
                <Link
                  to={back.path}
                  className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ledger-text-secondary transition-colors hover:text-ledger-primary"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  {back.label}
                </Link>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ledger-primary">
                Finance Management
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                <Link
                  to={user?.isAdmin ? '/home' : '/dashboard'}
                  aria-label="Go to home"
                  title="Go to home"
                  className="rounded-[var(--ledger-radius-control)] transition-opacity hover:opacity-80"
                >
                  <BrandMark className="h-9 w-9" />
                </Link>
                <h1 className="text-3xl font-semibold tracking-tight text-ledger-text sm:text-4xl">
                  ApexVoid Ledger
                </h1>
              </div>
              <p className="mt-2 max-w-xl text-sm text-ledger-text-secondary">
                A single place to see where your money stands across loans and cash flow.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {user?.isAdmin && (
                <Link
                  to="/settings/users"
                  aria-label="Manage users"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ledger-radius-control)] border border-ledger-border text-ledger-text-secondary transition-colors hover:bg-ledger-subtle hover:text-ledger-text"
                >
                  <UsersIcon className="h-[18px] w-[18px]" />
                </Link>
              )}
              <CurrencySelector />
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              {user && (
                <div className="ml-1 flex items-center gap-3 border-l border-ledger-border pl-3">
                  <span className="hidden max-w-[10rem] truncate text-sm text-ledger-text-secondary sm:inline">
                    {user.username}
                  </span>
                  <Link
                    to="/settings/users"
                    className="text-sm font-medium text-ledger-text-secondary transition-colors hover:text-ledger-primary"
                  >
                    User account
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-ledger-text-secondary transition-colors hover:text-ledger-primary"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0 6 6m-6-6 6-6" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
