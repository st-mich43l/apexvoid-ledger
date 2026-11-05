import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'apexvoid-ledger:hide-money'
const CARD_STORAGE_KEY = 'apexvoid-ledger:money-privacy-cards'
const listeners = new Set<() => void>()

function readPreference(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

let hidden = readPreference()
function readCardPreferences(): Map<string, boolean> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(CARD_STORAGE_KEY) ?? '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return new Map()
    return new Map(Object.entries(data).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'))
  } catch { return new Map() }
}

let cardPreferences = readCardPreferences()

function notify() { listeners.forEach(listener => listener()) }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === CARD_STORAGE_KEY || event.key === null) {
      hidden = readPreference()
      cardPreferences = readCardPreferences()
      notify()
    }
  })
}

export function isMoneyHidden() { return hidden }

export function setMoneyHidden(value: boolean) {
  hidden = value
  cardPreferences.clear()
  try {
    localStorage.removeItem(CARD_STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch { /* Remains active in this tab. */ }
  notify()
}

export function useCardMoneyPrivacy(key: string) {
  const value = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => cardPreferences.get(key) ?? hidden,
    () => false,
  )
  return [value, (next: boolean) => {
    cardPreferences.set(key, next)
    try { localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(Object.fromEntries(cardPreferences))) } catch { /* Remains active in this tab. */ }
    notify()
  }] as const
}

export function useMoneyPrivacy() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    isMoneyHidden,
    () => false,
  )
}
