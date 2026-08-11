export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND'] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

const currencyNames = new Intl.DisplayNames('en', { type: 'currency' })

export function currencyName(code: string): string {
  return currencyNames.of(code) ?? code
}

const CURRENCY_FLAGS: Record<CurrencyCode, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  AUD: '🇦🇺',
  JPY: '🇯🇵',
  CNY: '🇨🇳',
  VND: '🇻🇳',
}

export function currencyFlag(code: string): string {
  return CURRENCY_FLAGS[code as CurrencyCode] ?? '🏳️'
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatCurrency(amount: number, code: string): string {
  let formatter = formatters.get(code)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
    formatters.set(code, formatter)
  }
  return formatter.format(amount)
}
