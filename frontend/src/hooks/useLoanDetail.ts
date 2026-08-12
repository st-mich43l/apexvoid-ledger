import { useEffect, useState } from 'react'
import { ApiError, fetchLoanDetail, fetchLoanSchedule } from '../api'
import type { LoanDetail, LoanScheduleItem } from '../types'

const REFRESH_INTERVAL_MS = 60_000

interface UseLoanDetailResult {
  detail: LoanDetail | null
  schedule: LoanScheduleItem[]
  loading: boolean
  notFound: boolean
  error: string | null
}

export function useLoanDetail(loanId: string): UseLoanDetailResult {
  const [detail, setDetail] = useState<LoanDetail | null>(null)
  const [schedule, setSchedule] = useState<LoanScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(silent: boolean) {
      if (!silent) setLoading(true)
      try {
        const [detailResult, scheduleResult] = await Promise.all([
          fetchLoanDetail(loanId),
          fetchLoanSchedule(loanId),
        ])
        if (cancelled) return
        setDetail(detailResult)
        setSchedule(scheduleResult)
        setNotFound(false)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError('Failed to load this loan. Is the backend running?')
        }
      } finally {
        if (!cancelled && !silent) setLoading(false)
      }
    }

    load(false)

    // Same rationale as useLoans: balances/statuses depend on the current
    // date, so refresh periodically and whenever the tab regains focus.
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loanId])

  return { detail, schedule, loading, notFound, error }
}
