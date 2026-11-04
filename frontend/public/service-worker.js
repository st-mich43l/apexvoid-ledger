/* Push is optional; this worker does not cache financial pages or API responses. */
const DEFAULT_DESTINATION = '/dashboard'

function safeDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return DEFAULT_DESTINATION
  try {
    const url = new URL(value, self.location.origin)
    if (url.origin !== self.location.origin) return DEFAULT_DESTINATION
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_DESTINATION
  }
}

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* Show a generic notification. */ }
  const destination = safeDestination(payload?.destination)
  event.waitUntil(self.registration.showNotification('ApexVoid Ledger', {
    body: 'You have a new notification in Ledger.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { destination },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL(safeDestination(event.notification.data?.destination), self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      await existing.navigate(destination)
      await existing.focus()
    } else {
      await self.clients.openWindow(destination)
    }
  })())
})
