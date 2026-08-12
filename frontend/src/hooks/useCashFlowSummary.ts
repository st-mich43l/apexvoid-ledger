import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCashFlowSummary } from '../api'
import type { CurrencyCode } from '../lib/currency'
import type { CashFlowMonthlySummary } from '../types'

export function useCashFlowSummary(year: number, month: number, currency: CurrencyCode) {
  const [summary, setSummary] = useState<CashFlowMonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current
    setLoading(true)
    try {
      const next = await fetchCashFlowSummary(year, month, currency)
      if (activeRequest !== requestId.current) return
      setSummary(next)
      setError(null)
    } catch {
      if (activeRequest === requestId.current) setError('Failed to load cash-flow summary.')
    } finally {
      if (activeRequest === requestId.current) setLoading(false)
    }
  }, [year, month, currency])

  useEffect(() => {
    void reload()
  }, [reload])

  return { summary, loading, error, reload }
}
