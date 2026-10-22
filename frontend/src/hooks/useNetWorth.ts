import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNetWorthAccounts,
  fetchNetWorthSummary,
  refreshNetWorthAccount,
} from '../api'
import type { FinancialAccount, NetWorthSummary } from '../types'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export function useNetWorth() {
  const [summary, setSummary] = useState<NetWorthSummary | null>(null)
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    setError(null)
    try {
      const [nextSummary, nextAccounts] = await Promise.all([
        fetchNetWorthSummary(),
        fetchNetWorthAccounts(),
      ])
      if (!alive.current) return
      setSummary(nextSummary)
      setAccounts(nextAccounts)
    } catch (err) {
      if (!alive.current) return
      setError(err instanceof Error ? err.message : 'Unable to load net worth')
    } finally {
      if (alive.current && initial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load(true)
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)
    return () => {
      alive.current = false
      window.clearInterval(timer)
    }
  }, [load])

  const refresh = useCallback(async (accountId: string) => {
    setRefreshing(true)
    setError(null)
    try {
      await refreshNetWorthAccount(accountId)
      await load()
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'Unable to refresh bank balance')
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [load])

  return { summary, accounts, loading, refreshing, error, refresh, reload: load }
}
