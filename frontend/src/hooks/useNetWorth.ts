import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  connectNetWorthAccount,
  disconnectNetWorthAccount,
  fetchNetWorthAccounts,
  fetchNetWorthSummary,
  refreshNetWorthAccount,
} from '../api'
import { queryClient, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { FinancialAccount, NetWorthSummary, SePayConnectionInput } from '../types'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export function useNetWorth() {
  const { user } = useAuth()
  const [connecting, setConnecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: queryKeys.netWorth(user?.id ?? null),
    queryFn: async () => {
      const [summary, accounts] = await Promise.all([fetchNetWorthSummary(), fetchNetWorthAccounts()])
      return { summary, accounts }
    },
    enabled: Boolean(user),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  })

  async function reload() { await query.refetch() }

  async function refresh(accountId: string) {
    setActionError(null)
    try {
      await refreshNetWorthAccount(accountId)
      await queryClient.invalidateQueries({ queryKey: queryKeys.netWorth(user?.id ?? null) })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to refresh bank balance')
    }
  }

  async function connect(input: SePayConnectionInput) {
    setConnecting(true)
    setActionError(null)
    try {
      await connectNetWorthAccount(input)
      await queryClient.invalidateQueries({ queryKey: queryKeys.netWorth(user?.id ?? null) })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to connect SePay account')
      throw err
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect(accountId: string) {
    setActionError(null)
    try {
      await disconnectNetWorthAccount(accountId)
      await queryClient.invalidateQueries({ queryKey: queryKeys.netWorth(user?.id ?? null) })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to disconnect SePay account')
    }
  }

  return {
    summary: query.data?.summary ?? null as NetWorthSummary | null,
    accounts: query.data?.accounts ?? [] as FinancialAccount[],
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading,
    connecting,
    error: actionError ?? (query.error ? (query.error instanceof Error ? query.error.message : 'Unable to load net worth') : null),
    refresh,
    connect,
    disconnect,
    reload,
  }
}
