import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTransactions } from '../api'
import type { LedgerTransaction } from '../types'

export function useTransactions(year: number, month: number) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current
    setLoading(true)
    try {
      const next = await fetchTransactions({ year, month })
      if (activeRequest !== requestId.current) return
      setTransactions(next)
      setError(null)
    } catch {
      if (activeRequest === requestId.current) setError('Failed to load transactions.')
    } finally {
      if (activeRequest === requestId.current) setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    void reload()
  }, [reload])

  return { transactions, loading, error, reload }
}
