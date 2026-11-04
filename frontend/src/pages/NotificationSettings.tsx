import { useCallback, useEffect, useState } from 'react'
import { deletePushDevice, fetchNotificationPreferences, fetchPushConfig, fetchPushDevices, saveNotificationPreferences, savePushDevice, sendTestPush, type NotificationPreferences, type PushDevice } from '../api'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import { decodeVapidKey, rememberPushDevice, storedPushDevice, supportedPush } from '../lib/push'

export function NotificationSettingsPage() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(supportedPush() ? Notification.permission : 'unsupported')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const load = useCallback(async () => {
    try {
      const [prefs, list, config] = await Promise.all([fetchNotificationPreferences(), fetchPushDevices(), fetchPushConfig()])
      setPreferences(prefs); setDevices(list); setPublicKey(config.publicKey)
      const current = storedPushDevice()
      const registration = supportedPush() ? await navigator.serviceWorker.getRegistration('/') : null
      const subscription = await registration?.pushManager.getSubscription()
      setCurrentId(subscription && current && current.userId === user?.id && list.some(device => device.id === current.id && device.enabled) ? current.id : null)
    } catch { setError('Notification settings could not be loaded.') }
  }, [user?.id])
  useEffect(() => { void load() }, [load])

  async function enable() {
    if (!user || !publicKey || !supportedPush()) return
    setError(null); setMessage(null); setBusy(true)
    try {
      const granted = await Notification.requestPermission()
      setPermission(granted)
      if (granted !== 'granted') return
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      // A browser subscription is unique to an origin, not a Ledger account.
      // After an account change, discard an untracked previous subscription
      // before trying to associate its endpoint with the new account.
      const remembered = storedPushDevice()
      if (subscription && remembered?.userId !== user.id) {
        await subscription.unsubscribe()
        subscription = null
        rememberPushDevice(null)
      }
      let created = false
      if (!subscription) { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicKey) }); created = true }
      try {
        const device = await savePushDevice(subscription.toJSON())
        rememberPushDevice({ userId: user.id, id: device.id }); setCurrentId(device.id); setMessage('This device is registered for notifications.'); await load()
      } catch (caught) { if (created) await subscription.unsubscribe(); throw caught }
    } catch { setError('Could not enable notifications. Check your browser permissions and server configuration; a device linked to another account must first be revoked by that account.') } finally { setBusy(false) }
  }

  async function revoke(device: PushDevice) {
    setBusy(true); setError(null)
    try {
      await deletePushDevice(device.id)
      if (device.id === currentId) {
        const registration = await navigator.serviceWorker.getRegistration('/')
        await (await registration?.pushManager.getSubscription())?.unsubscribe()
        rememberPushDevice(null); setCurrentId(null)
      }
      await load()
    } catch { setError('Could not disable that device.') } finally { setBusy(false) }
  }

  return <section className="mx-auto max-w-4xl"><PageHeader eyebrow="Your account" title="Notification settings" description="Manage browser delivery and your devices." />
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}{message && <Alert tone="success" className="mb-4">{message}</Alert>}
    <div className="space-y-4"><Card><h2 className="font-semibold text-ledger-text">This device</h2><p className="mt-2 text-sm text-ledger-text-secondary">Permission: {permission}. {currentId ? 'This device is registered.' : 'This device is not registered.'}</p>
      {permission === 'unsupported' && <p className="mt-2 text-sm text-ledger-text-secondary">{isAppleMobile ? 'To use push on iPhone or iPad, add Ledger to the Home Screen and open it there.' : 'Push is unavailable in this browser or connection. Try a supported browser over HTTPS.'} Your inbox remains available.</p>}
      {permission === 'denied' && <p className="mt-2 text-sm text-ledger-text-secondary">Notifications are blocked. Change this site’s permission in your browser settings.</p>}
      {!publicKey && <p className="mt-2 text-sm text-ledger-text-secondary">Push delivery is not configured on the server.</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => void enable()} disabled={busy || !publicKey || permission === 'unsupported' || permission === 'denied'}>Enable on this device</Button>{currentId && <Button type="button" variant="outline" disabled={busy} onClick={() => void sendTestPush(currentId).then(() => setMessage('Test notification queued. Delivery is not guaranteed.')).catch(() => setError('Could not queue a test notification.'))}>Send test</Button>}</div>
    </Card>
    <Card><h2 className="font-semibold text-ledger-text">Devices</h2>{devices.length === 0 ? <p className="mt-2 text-sm text-ledger-text-secondary">No registered devices.</p> : <ul className="mt-3 divide-y divide-ledger-border">{devices.map(device => <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm text-ledger-text">{device.deviceName}{device.id === currentId ? ' · This device' : ''}</p><p className="text-xs text-ledger-text-secondary">{device.enabled ? 'Enabled' : 'Disabled'}</p></div>{device.enabled && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void revoke(device)}>Disable</Button>}</li>)}</ul>}</Card>
    {preferences && <Card><h2 className="font-semibold text-ledger-text">Notification preferences</h2><p className="mt-1 text-sm text-ledger-text-secondary">Choose which events appear in your inbox and are sent to enabled devices.</p><label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-ledger-text"><input type="checkbox" checked={preferences.bankActivity} onChange={event => setPreferences({ ...preferences, bankActivity: event.target.checked })} />Bank activity</label><p className="text-xs text-ledger-text-secondary">Budget alerts, payment reminders and monthly summaries are not available yet.</p><Button className="mt-4" disabled={busy} onClick={() => void saveNotificationPreferences(preferences).then(() => setMessage('Preferences saved.')).catch(() => setError('Could not save preferences.'))}>Save preferences</Button></Card>}
    </div></section>
}
