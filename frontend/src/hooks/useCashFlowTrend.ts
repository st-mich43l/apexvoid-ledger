import { useQuery } from '@tanstack/react-query'
import { fetchCashFlowTrend } from '../api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { CurrencyCode } from '../lib/currency'
import type { CashFlowTrendSummary } from '../types'

export function useCashFlowTrend(endYear: number, endMonth: number, months: 6 | 12, currency: CurrencyCode) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.cashFlowTrend(user?.id ?? null, endYear, endMonth, months, currency),
    queryFn: () => fetchCashFlowTrend(endYear, endMonth, months, currency),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
  })
  return {
    summary: query.data ?? null as CashFlowTrendSummary | null,
    loading: query.isLoading,
    error: query.error ? 'Failed to load financial trends.' : null,
    reload: async () => { await query.refetch() },
  }
}
