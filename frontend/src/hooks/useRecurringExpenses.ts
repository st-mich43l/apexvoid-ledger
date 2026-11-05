import { useQuery } from '@tanstack/react-query'
import { fetchRecurringExpenses } from '../api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { RecurringExpense } from '../types'

export function useRecurringExpenses() {
  const { user } = useAuth()
  const query = useQuery({ queryKey: queryKeys.recurringExpenses(user?.id ?? null), queryFn: () => fetchRecurringExpenses(), enabled: Boolean(user), staleTime: 60_000, gcTime: 60 * 60_000 })
  return { items: query.data ?? [] as RecurringExpense[], loading: query.isLoading, error: query.error ? 'Failed to load monthly fixed costs.' : null, reload: async () => { await query.refetch() } }
}
