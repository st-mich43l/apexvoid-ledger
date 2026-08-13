import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCashFlowTrend } from '../api'
import type { CurrencyCode } from '../lib/currency'
import type { CashFlowTrendSummary } from '../types'

export function useCashFlowTrend(
  endYear: number,
  endMonth: number,
  months: 6 | 12,
  currency: CurrencyCode,
) {
  const [summary, setSummary] = useState<CashFlowTrendSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current
    setLoading(true)
    try {
      const next = await fetchCashFlowTrend(endYear, endMonth, months, currency)
      if (activeRequest !== requestId.current) return
      setSummary(next)
      setError(null)
    } catch {
      if (activeRequest === requestId.current) {
        setError('Failed to load financial trends.')
      }
    } finally {
      if (activeRequest === requestId.current) setLoading(false)
    }
  }, [endYear, endMonth, months, currency])

  useEffect(() => {
    void reload()
  }, [reload])

  return { summary, loading, error, reload }
}
