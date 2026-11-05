import { useQuery } from '@tanstack/react-query'
import { fetchCashFlowSummary } from '../api'
import { useAuth } from './useAuth'
import { periodStaleTime, queryKeys } from '../lib/queryClient'
import type { CurrencyCode } from '../lib/currency'
import type { CashFlowMonthlySummary } from '../types'

export function useCashFlowSummary(year: number, month: number, currency: CurrencyCode) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.cashFlowSummary(user?.id ?? null, year, month, currency),
    queryFn: () => fetchCashFlowSummary(year, month, currency),
    enabled: Boolean(user),
    staleTime: periodStaleTime(year, month, 30_000, 5 * 60_000),
    gcTime: 30 * 60_000,
  })
  return {
    summary: query.data ?? null as CashFlowMonthlySummary | null,
    loading: query.isLoading,
    error: query.error ? 'Failed to load cash-flow summary.' : null,
    reload: async () => { await query.refetch() },
  }
}
