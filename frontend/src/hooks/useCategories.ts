import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '../api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { Category } from '../types'

export function useCategories(includeInactive = false) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.categories(user?.id ?? null, includeInactive),
    queryFn: () => fetchCategories(includeInactive),
    enabled: Boolean(user),
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
  })
  return {
    categories: query.data ?? [] as Category[],
    loading: query.isLoading,
    error: query.error ? 'Failed to load categories.' : null,
    reload: async () => { await query.refetch() },
  }
}
