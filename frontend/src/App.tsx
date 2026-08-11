import { useEffect, useState } from 'react'
import { createLoan, deleteLoan, fetchLoans } from './api'
import { LoanForm } from './components/LoanForm'
import { LoanTable } from './components/LoanTable'
import { SummaryStats } from './components/SummaryStats'
import type { Loan, LoanInput } from './types'

function App() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            apexvoid-ledger
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Track your loans across banks in one place.
          </p>
        </header>

        {error && (
          <p className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="mb-8">
          <LoanForm onSubmit={handleCreate} />
        </section>

        <section className="mb-8">
          <SummaryStats loans={loans} />
        </section>

        <section>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : (
            <LoanTable loans={loans} onDelete={handleDelete} />
          )}
        </section>
      </div>
    </div>
  )
}

export default App
