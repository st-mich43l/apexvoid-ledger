import { useEffect, useState } from 'react'
import { createLoan, deleteLoan, fetchLoans } from '../api'
import type { Loan, LoanInput } from '../types'

export function useLoans() {
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

  return { loans, loading, error, createLoan: handleCreate, deleteLoan: handleDelete }
}
