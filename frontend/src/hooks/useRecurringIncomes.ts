import { useCallback, useEffect, useState } from 'react'
import { fetchRecurringIncomes } from '../api'
import type { RecurringIncome } from '../types'

export function useRecurringIncomes() {
  const [items, setItems] = useState<RecurringIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchRecurringIncomes())
      setError(null)
    } catch {
      setError('Failed to load expected income.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, loading, error, reload }
}
