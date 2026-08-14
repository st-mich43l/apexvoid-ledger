import { useCallback, useEffect, useState } from 'react'
import { closeMonth, fetchMonthlyClose, recloseMonth } from '../api'
import type { MonthlyCloseSummary } from '../types'

export function useMonthlyClose(year: number, month: number) {
  const [summary, setSummary] = useState<MonthlyCloseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await fetchMonthlyClose(year, month))
      setError(null)
    } catch {
      setError('Failed to load monthly close.')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    void reload()
  }, [reload])

  const close = useCallback(async (note?: string) => {
    const result = await closeMonth(year, month, note)
    setSummary(result)
    setError(null)
    return result
  }, [year, month])

  const reclose = useCallback(async (reason: string) => {
    const result = await recloseMonth(year, month, reason)
    setSummary(result)
    setError(null)
    return result
  }, [year, month])

  return { summary, loading, error, reload, close, reclose }
}
