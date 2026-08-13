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
  if (pathname === '/saving-pot') return { path: '/dashboard', label: 'Dashboard' }
  if (pathname === '/settings/users') return { path: '/home', label: 'Home' }
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
    <div className="min-h-screen bg-neutral-50 [background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.16),transparent_70%)] dark:bg-neutral-950 dark:[background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.10),transparent_70%)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="relative mb-10 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white/80 p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] backdrop-blur-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/60 dark:shadow-none">
          <div className="pointer-events-none absolute -top-20 -left-10 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {back && (
                <Link
                  to={back.path}
                  className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-violet-600 dark:text-neutral-400 dark:hover:text-violet-400"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  {back.label}
                </Link>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
                Finance Management
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                <BrandMark className="h-9 w-9" />
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
                  ApexVoid Ledger
                </h1>
              </div>
              <p className="mt-2 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
                A single place to see where your money stands across loans and cash flow.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {user?.isAdmin && (
                <Link
                  to="/settings/users"
                  aria-label="Manage users"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
                >
                  <UsersIcon className="h-[18px] w-[18px]" />
                </Link>
              )}
              <CurrencySelector />
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              {user && (
                <div className="ml-1 flex items-center gap-2 border-l border-neutral-200 pl-3 dark:border-neutral-800">
                  <span className="hidden max-w-[10rem] truncate text-sm text-neutral-500 sm:inline dark:text-neutral-400">
                    {user.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-neutral-500 transition-colors hover:text-violet-600 dark:text-neutral-400 dark:hover:text-violet-400"
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
