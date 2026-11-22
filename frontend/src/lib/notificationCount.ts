import { useSyncExternalStore } from 'react'
import { fetchNotificationCount } from '../api'

// One shared unread count for the whole app, kept live by a single EventSource
// (/api/notifications/stream). Falls back to polling if SSE is unavailable.
let count = 0
const listeners = new Set<() => void>()
let source: EventSource | null = null
let pollTimer: number | undefined

function set(next: number) {
  if (next === count) return
  count = next
  listeners.forEach((listener) => listener())
}

async function refresh() {
  try { set((await fetchNotificationCount()).count) } catch { /* keep last known count */ }
}

function startPolling() {
  if (pollTimer === undefined) pollTimer = window.setInterval(() => void refresh(), 30_000)
}

function connect() {
  void refresh()
  window.addEventListener('focus', refresh)
  if (typeof EventSource === 'undefined') return startPolling()
  source = new EventSource('/api/notifications/stream')
  source.addEventListener('count', (event) => {
    try { set(JSON.parse((event as MessageEvent<string>).data).count) } catch { /* ignore malformed frame */ }
  })
  // The browser auto-reconnects while CONNECTING; CLOSED means a hard failure (e.g. 401/403).
  source.onerror = () => { if (source?.readyState === EventSource.CLOSED) startPolling() }
}

function disconnect() {
  window.removeEventListener('focus', refresh)
  source?.close()
  source = null
  window.clearInterval(pollTimer)
  pollTimer = undefined
  count = 0
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) disconnect()
  }
}

/** Live unread count. Mount at least one consumer (the bell) to keep the stream open. */
export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0)
}

/** Optimistic local update after read/clear actions; the stream confirms it shortly after. */
export function setUnreadCount(next: number) { set(Math.max(0, next)) }
