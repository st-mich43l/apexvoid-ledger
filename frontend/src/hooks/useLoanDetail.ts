import { useQuery } from '@tanstack/react-query'
import { ApiError, fetchLoanDetail, fetchLoanSchedule } from '../api'
import { queryKeys } from '../lib/queryClient'
import { useAuth } from './useAuth'
import type { LoanDetail, LoanScheduleItem } from '../types'

const REFRESH_INTERVAL_MS = 60_000

interface UseLoanDetailResult {
  detail: LoanDetail | null
  schedule: LoanScheduleItem[]
  loading: boolean
  notFound: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useLoanDetail(loanId: string): UseLoanDetailResult {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.loanDetail(user?.id ?? null, loanId),
    queryFn: async () => {
      const [detail, schedule] = await Promise.all([fetchLoanDetail(loanId), fetchLoanSchedule(loanId)])
      return { detail, schedule }
    },
    enabled: Boolean(user && loanId),
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  })
  return {
    detail: query.data?.detail ?? null,
    schedule: query.data?.schedule ?? [],
    loading: query.isLoading,
    notFound: query.error instanceof ApiError && query.error.status === 404,
    error: query.error && !(query.error instanceof ApiError && query.error.status === 404) ? 'Failed to load this loan. Is the backend running?' : null,
    refetch: async () => { await query.refetch() },
  }
}
