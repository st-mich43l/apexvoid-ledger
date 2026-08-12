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
  const cancelledRef = useRef(false)

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true)
      try {
        const [detailResult, scheduleResult] = await Promise.all([
          fetchLoanDetail(loanId),
          fetchLoanSchedule(loanId),
        ])
        if (cancelledRef.current) return
        setDetail(detailResult)
        setSchedule(scheduleResult)
        setNotFound(false)
        setError(null)
      } catch (err) {
        if (cancelledRef.current) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError('Failed to load this loan. Is the backend running?')
        }
      } finally {
        if (!cancelledRef.current && !silent) setLoading(false)
      }
    },
    [loanId],
  )

  useEffect(() => {
    cancelledRef.current = false
    load(false)

    // Same rationale as useLoans: balances/statuses depend on the current
    // date, so refresh periodically and whenever the tab regains focus.
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelledRef.current = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const refetch = useCallback(() => load(true), [load])

  return { detail, schedule, loading, notFound, error, refetch }
}
