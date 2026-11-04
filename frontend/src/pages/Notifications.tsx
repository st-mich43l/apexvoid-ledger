import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type InboxNotification } from '../api'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

function safeDestination(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard'
  const url = new URL(value, window.location.origin)
  return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/dashboard'
}

export function NotificationsPage() {
  const [items, setItems] = useState<InboxNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const load = useCallback(async () => {
    try { setItems(await fetchNotifications()); setError(null) } catch { setError('Could not load notifications.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function open(item: InboxNotification) {
    try { if (!item.readAt) await markNotificationRead(item.id); navigate(safeDestination(item.destination)) } catch { setError('Could not mark this notification as read.') }
  }

  return <section className="mx-auto max-w-4xl"><PageHeader eyebrow="Your account" title="Notifications" description="Your recent Ledger activity." actions={<Link to="/settings/notifications" className="text-sm font-semibold text-ledger-primary">Notification settings →</Link>} />
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <Card padding="none" className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-ledger-border p-4"><h2 className="font-semibold text-ledger-text">Inbox</h2><Button variant="ghost" size="sm" disabled={!items.some(item => !item.readAt)} onClick={() => void markAllNotificationsRead().then(load).catch(() => setError('Could not mark notifications as read.'))}>Mark all read</Button></div>
      {loading ? <p className="p-5 text-sm text-ledger-text-secondary">Loading notifications…</p> : items.length === 0 ? <p className="p-5 text-sm text-ledger-text-secondary">No notifications yet.</p> : <ul className="divide-y divide-ledger-border">{items.map(item => <li key={item.id}><button type="button" onClick={() => void open(item)} className="flex min-h-16 w-full items-start gap-3 p-4 text-left hover:bg-ledger-subtle"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-ledger-border' : 'bg-violet-500'}`} aria-label={item.readAt ? 'Read' : 'Unread'} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ledger-text">{item.title}</span><span className="mt-1 block text-sm text-ledger-text-secondary">{item.body}</span><span className="mt-1 block text-xs text-ledger-muted">{new Date(item.createdAt).toLocaleString()}</span></span><span aria-hidden="true" className="text-ledger-primary">→</span></button></li>)}</ul>}
    </Card></section>
}
