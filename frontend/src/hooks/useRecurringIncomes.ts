import { useQuery } from '@tanstack/react-query'
import { fetchRecurringIncomes } from '../api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { RecurringIncome } from '../types'

export function useRecurringIncomes() {
  const { user } = useAuth()
  const query = useQuery({ queryKey: queryKeys.recurringIncomes(user?.id ?? null), queryFn: () => fetchRecurringIncomes(), enabled: Boolean(user), staleTime: 60_000, gcTime: 60 * 60_000 })
  return { items: query.data ?? [] as RecurringIncome[], loading: query.isLoading, error: query.error ? 'Failed to load expected income.' : null, reload: async () => { await query.refetch() } }
}
