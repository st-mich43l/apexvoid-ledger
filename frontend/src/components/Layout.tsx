import { Outlet } from 'react-router-dom'
import { CurrencySelector } from './CurrencySelector'
import { ThemeToggle } from './ThemeToggle'
import { useTheme } from '../hooks/useTheme'

export function Layout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
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
        </header>

        <Outlet />
      </div>
    </div>
  )
}
