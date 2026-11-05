import { useEffect, useRef, type ReactNode } from 'react'
import { queryClient } from '../lib/queryClient'
import { useAuth } from '../hooks/useAuth'

export function AccountQueryBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const previousUserId = useRef<string | null>(null)
  useEffect(() => {
    const nextUserId = user?.id ?? null
    if (previousUserId.current !== nextUserId) {
      if (previousUserId.current !== null || nextUserId === null) queryClient.clear()
      previousUserId.current = nextUserId
    }
  }, [user?.id])
  return children
}
