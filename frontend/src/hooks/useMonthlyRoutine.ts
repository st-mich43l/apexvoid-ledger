import { useQuery } from '@tanstack/react-query'
import { fetchMonthlyRoutine } from '../api'
import { periodStaleTime, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { CurrencyCode } from '../lib/currency'
import type { MonthlyRoutineSummary } from '../types'

export function useMonthlyRoutine(year: number, month: number, currency: CurrencyCode, enabled = true) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: queryKeys.monthlyRoutine(user?.id ?? null, year, month, currency), queryFn: () => fetchMonthlyRoutine(year, month, currency), enabled: Boolean(user && enabled), staleTime: periodStaleTime(year, month, 60_000, 10 * 60_000), gcTime: 30 * 60_000 })
  return {
    summary: query.data ?? null as MonthlyRoutineSummary | null,
    loading: query.isLoading,
    error: query.error ? 'Failed to load monthly routine.' : null,
    reload: async () => { await query.refetch() },
  }
}
