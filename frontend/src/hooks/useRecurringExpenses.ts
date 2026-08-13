import { useCallback, useEffect, useState } from 'react'
import { fetchRecurringExpenses } from '../api'
import type { RecurringExpense } from '../types'

export function useRecurringExpenses() {
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchRecurringExpenses())
      setError(null)
    } catch {
      setError('Failed to load monthly fixed costs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, loading, error, reload }
}
