import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchNotificationCount } from '../../api'

export function NotificationBell() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    async function refresh() { try { const result = await fetchNotificationCount(); if (active) setCount(result.count) } catch { /* Inbox remains accessible. */ } }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  return <Link to="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ledger-text-secondary hover:bg-ledger-subtle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9M10 21h4" /></svg>{count > 0 && <span aria-hidden="true" className="absolute right-1 top-1 min-w-4 rounded-full bg-violet-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</span>}</Link>
}
