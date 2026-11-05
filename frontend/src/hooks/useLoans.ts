import { useQuery } from '@tanstack/react-query'
import { createLoan, deleteLoan, fetchLoans } from '../api'
import { invalidateLoans, queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { Loan, LoanInput } from '../types'

export function useLoans() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.loans(user?.id ?? null),
    queryFn: () => fetchLoans(),
    enabled: Boolean(user),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  async function refresh() { await query.refetch() }
  async function create(input: LoanInput) {
    await createLoan(input)
    await invalidateLoans(user?.id ?? null)
  }
  async function remove(id: string) {
    await deleteLoan(id)
    await invalidateLoans(user?.id ?? null)
  }

  return {
    loans: query.data ?? [] as Loan[],
    loading: query.isLoading,
    error: query.error ? 'Failed to load loans. Is the backend running?' : null,
    createLoan: create,
    deleteLoan: remove,
    reload: refresh,
  }
}
