import { ApiError, deletePushDevice } from '../api'

const KEY = 'apexvoid-ledger:push-device'
export type StoredPushDevice = { userId: string; id: string }
export function supportedPush(): boolean { return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window }
export function storedPushDevice(): StoredPushDevice | null {
  try { const data = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return data && typeof data.userId === 'string' && typeof data.id === 'string' ? data : null } catch { return null }
}
export function rememberPushDevice(value: StoredPushDevice | null) { if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY) }
export function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}
export async function releaseCurrentPush(userId: string) {
  const stored = storedPushDevice()
  if (!stored || stored.userId !== userId) return
  try { await deletePushDevice(stored.id) } catch (error) { if (!(error instanceof ApiError) || error.status !== 404) throw error }
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    await subscription?.unsubscribe()
  }
  rememberPushDevice(null)
}
