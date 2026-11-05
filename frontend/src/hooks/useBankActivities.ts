import { useQuery } from '@tanstack/react-query'
import { fetchBankActivities } from '../api'
import { periodStaleTime, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { BankActivity } from '../types'

export function useBankActivities(year: number, month: number) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.bankActivities(user?.id ?? null, year, month),
    queryFn: () => fetchBankActivities({ year, month }),
    enabled: Boolean(user),
    staleTime: periodStaleTime(year, month, 20_000, 2 * 60_000),
    gcTime: 15 * 60_000,
  })
  return {
    activities: query.data ?? [] as BankActivity[],
    loading: query.isLoading,
    error: query.error ? 'Failed to load bank activity.' : null,
    reload: async () => { await query.refetch() },
  }
}
