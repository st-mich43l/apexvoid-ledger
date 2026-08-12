import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, fetchLoanDetail, fetchLoanSchedule } from '../api'
import type { LoanDetail, LoanScheduleItem } from '../types'

const REFRESH_INTERVAL_MS = 60_000

interface UseLoanDetailResult {
  detail: LoanDetail | null
  schedule: LoanScheduleItem[]
  loading: boolean
  notFound: boolean
  error: string | null
  // Silent (no loading flash) — for use after an edit/delete elsewhere on
  // the page, where the previous data staying on screen while it refreshes
  // reads better than a loading flicker.
  refetch: () => Promise<void>
}

export function useLoanDetail(loanId: string): UseLoanDetailResult {
  const [detail, setDetail] = useState<LoanDetail | null>(null)
  const [schedule, setSchedule] = useState<LoanScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [responseLoanId, setResponseLoanId] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(
    async (silent: boolean) => {
      const requestId = ++requestIdRef.current
      if (!silent) {
        setLoading(true)
        setNotFound(false)
        setError(null)
      }
      try {
        const [detailResult, scheduleResult] = await Promise.all([
          fetchLoanDetail(loanId),
          fetchLoanSchedule(loanId),
        ])
        if (requestId !== requestIdRef.current) return
        setDetail(detailResult)
        setSchedule(scheduleResult)
        setResponseLoanId(loanId)
        setNotFound(false)
        setError(null)
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setResponseLoanId(loanId)
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
          setError(null)
        } else {
          setNotFound(false)
          setError('Failed to load this loan. Is the backend running?')
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    },
    [loanId],
  )

  useEffect(() => {
    load(false)

    // Same rationale as useLoans: balances/statuses depend on the current
    // date, so refresh periodically and whenever the tab regains focus.
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      // Invalidate every in-flight request immediately. The next effect/load
      // receives a newer id, so a response for the previous route cannot
      // commit even between this cleanup and the next request starting.
      requestIdRef.current += 1
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const refetch = useCallback(() => load(true), [load])
  const responseMatchesRoute = responseLoanId === loanId
  const detailMatchesRoute = responseMatchesRoute && detail?.id === loanId

  return {
    detail: detailMatchesRoute ? detail : null,
    schedule: detailMatchesRoute ? schedule : [],
    loading: loading || !responseMatchesRoute,
    notFound: responseMatchesRoute && notFound,
    error: responseMatchesRoute ? error : null,
    refetch,
  }
}
