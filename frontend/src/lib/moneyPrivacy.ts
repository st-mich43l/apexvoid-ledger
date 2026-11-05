import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'apexvoid-ledger:hide-money'
const listeners = new Set<() => void>()

function readPreference(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

let hidden = readPreference()
const cardPreferences = new Map<string, boolean>()

function notify() { listeners.forEach(listener => listener()) }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      hidden = readPreference()
      cardPreferences.clear()
      notify()
    }
  })
}

export function isMoneyHidden() { return hidden }

export function setMoneyHidden(value: boolean) {
  hidden = value
  cardPreferences.clear()
  try { localStorage.setItem(STORAGE_KEY, String(value)) } catch { /* Remains active in this tab. */ }
  notify()
}

export function useCardMoneyPrivacy(key: string) {
  const value = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => cardPreferences.get(key) ?? hidden,
    () => false,
  )
  return [value, (next: boolean) => { cardPreferences.set(key, next); notify() }] as const
}

export function useMoneyPrivacy() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    isMoneyHidden,
    () => false,
  )
}
