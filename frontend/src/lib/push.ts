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

// Browser subscriptions outlive an authenticated web session. Never leave an
// old account's subscription attached to this browser after a sign-out or
// account change, even when the server can no longer revoke its record.
export async function discardLocalPush() {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager?.getSubscription()
      await subscription?.unsubscribe()
    }
  } finally {
    rememberPushDevice(null)
  }
}

export async function reconcileLocalPushForUser(userId: string | null) {
  const stored = storedPushDevice()
  if (stored && stored.userId !== userId) await discardLocalPush()
}

export async function releaseCurrentPush(userId: string) {
  const stored = storedPushDevice()
  try {
    if (stored?.userId === userId) {
      try { await deletePushDevice(stored.id) } catch (error) {
        // A missing/expired session cannot revoke the server record, but its
        // browser endpoint still has to be unsubscribed immediately.
        if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) throw error
      }
    }
  } finally {
    await discardLocalPush()
  }
}
