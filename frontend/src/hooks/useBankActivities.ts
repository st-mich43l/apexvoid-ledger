import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBankActivities } from '../api'
import type { BankActivity, BankActivityDirection, BankActivityClassification } from '../types'

export function useBankActivities(year: number, month: number) {
  const [activities, setActivities] = useState<BankActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(async (filters?: {
    direction?: BankActivityDirection
    classification?: BankActivityClassification
    categoryId?: string
    accountId?: string
    processingStatus?: string
  }) => {
    const activeRequest = ++requestId.current
    setLoading(true)
    try {
      const next = await fetchBankActivities({ year, month, ...filters })
      if (activeRequest !== requestId.current) return
      setActivities(next)
      setError(null)
    } catch {
      if (activeRequest === requestId.current) setError('Failed to load bank activity.')
    } finally {
      if (activeRequest === requestId.current) setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    void reload()
  }, [reload])

  return { activities, loading, error, reload }
}
