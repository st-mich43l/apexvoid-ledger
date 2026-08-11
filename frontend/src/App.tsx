import { useEffect, useState } from 'react'
import { createLoan, deleteLoan, fetchLoans } from './api'
import { LoanForm } from './components/LoanForm'
import { LoanTable } from './components/LoanTable'
import { SummaryStats } from './components/SummaryStats'
import { ThemeToggle } from './components/ThemeToggle'
import { useTheme } from './hooks/useTheme'
import type { Loan, LoanInput } from './types'

function App() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    loadLoans()
  }, [])

  async function loadLoans() {
    setLoading(true)
    try {
      setLoans(await fetchLoans())
      setError(null)
    } catch {
      setError('Failed to load loans. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(input: LoanInput) {
    await createLoan(input)
    await loadLoans()
  }

  async function handleDelete(id: string) {
    await deleteLoan(id)
    await loadLoans()
  }

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
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="mb-10">
          <SummaryStats loans={loans} />
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Loans</h2>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {loans.length} {loans.length === 1 ? 'loan' : 'loans'}
            </span>
          </div>

          <div className="mb-6">
            <LoanForm onSubmit={handleCreate} />
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : (
            <LoanTable loans={loans} onDelete={handleDelete} />
          )}
        </section>
      </div>
    </div>
  )
}

export default App
