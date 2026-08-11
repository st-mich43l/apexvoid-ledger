import { useEffect, useState } from 'react'
import { createLoan, deleteLoan, fetchLoans } from '../api'
import type { Loan, LoanInput } from '../types'

const REFRESH_INTERVAL_MS = 60_000

export function useLoans() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLoans()

    // Balances/maturity depend on the current date, so refresh periodically
    // and whenever the tab regains focus, instead of only on page load.
    const interval = setInterval(() => loadLoans({ silent: true }), REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadLoans({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function loadLoans(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true)
    try {
      setLoans(await fetchLoans())
      setError(null)
    } catch {
      setError('Failed to load loans. Is the backend running?')
    } finally {
      if (!options?.silent) setLoading(false)
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

  return { loans, loading, error, createLoan: handleCreate, deleteLoan: handleDelete }
}
