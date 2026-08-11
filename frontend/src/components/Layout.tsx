import { Link, Outlet, useLocation } from 'react-router-dom'
import { CurrencySelector } from './CurrencySelector'
import { ThemeToggle } from './ThemeToggle'
import { useTheme } from '../hooks/useTheme'

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const showBackButton = pathname !== '/dashboard'

  return (
    <div className="min-h-screen bg-neutral-50 [background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.16),transparent_70%)] dark:bg-neutral-950 dark:[background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.10),transparent_70%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="relative mb-10 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white/80 p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] backdrop-blur-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/60 dark:shadow-none">
          <div className="pointer-events-none absolute -top-20 -left-10 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              {showBackButton && (
                <Link
                  to="/dashboard"
                  className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-violet-600 dark:text-neutral-400 dark:hover:text-violet-400"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Dashboard
                </Link>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
                Finance Management
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
                apexvoid
              </h1>
              <p className="mt-2 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
                A single place to see where your money stands, starting with your loans.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CurrencySelector />
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
