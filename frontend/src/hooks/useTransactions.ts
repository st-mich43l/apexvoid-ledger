import { useQuery } from '@tanstack/react-query'
import { fetchTransactions } from '../api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { LedgerTransaction } from '../types'

export function useTransactions(year: number, month: number) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.transactions(user?.id ?? null, year, month),
    queryFn: () => fetchTransactions({ year, month }),
    enabled: Boolean(user),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
  })
  return {
    transactions: query.data ?? [] as LedgerTransaction[],
    loading: query.isLoading,
    error: query.error ? 'Failed to load transactions.' : null,
    reload: async () => { await query.refetch() },
  }
}
