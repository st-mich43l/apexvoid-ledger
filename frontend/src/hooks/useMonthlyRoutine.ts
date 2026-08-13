import { useCallback, useEffect, useState } from 'react'
import { fetchMonthlyRoutine } from '../api'
import type { CurrencyCode } from '../lib/currency'
import type { MonthlyRoutineSummary } from '../types'

export function useMonthlyRoutine(year: number, month: number, currency: CurrencyCode) {
  const [summary, setSummary] = useState<MonthlyRoutineSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await fetchMonthlyRoutine(year, month, currency))
      setError(null)
    } catch {
      setError('Failed to load monthly routine.')
    } finally {
      setLoading(false)
    }
  }, [year, month, currency])

  useEffect(() => {
    void reload()
  }, [reload])

  return { summary, loading, error, reload }
}
