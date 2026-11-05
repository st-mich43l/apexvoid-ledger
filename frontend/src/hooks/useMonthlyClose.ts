import { useQuery } from '@tanstack/react-query'
import { closeMonth, fetchMonthlyClose, recloseMonth } from '../api'
import { queryClient, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { MonthlyCloseSummary } from '../types'

export function useMonthlyClose(year: number, month: number) {
  const { user } = useAuth()
  const key = queryKeys.monthlyClose(user?.id ?? null, year, month)
  const query = useQuery({ queryKey: key, queryFn: () => fetchMonthlyClose(year, month), enabled: Boolean(user), staleTime: 60_000, gcTime: 60 * 60_000 })
  async function apply(result: MonthlyCloseSummary) { queryClient.setQueryData(key, result); return result }
  return {
    summary: query.data ?? null as MonthlyCloseSummary | null,
    loading: query.isLoading,
    error: query.error ? 'Failed to load monthly close.' : null,
    reload: async () => { await query.refetch() },
    close: async (note?: string) => apply(await closeMonth(year, month, note)),
    reclose: async (reason: string) => apply(await recloseMonth(year, month, reason)),
  }
}
