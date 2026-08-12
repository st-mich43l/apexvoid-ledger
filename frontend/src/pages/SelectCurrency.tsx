import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLockup } from '../components/BrandMark'
import { useAuth } from '../context/AuthContext'
import { currencyName, SUPPORTED_CURRENCIES, type CurrencyCode } from '../lib/currency'
import { CURRENCY_FLAG_SRC } from '../lib/flags'

export function SelectCurrencyPage() {
  const { setPreferredCurrency } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState<CurrencyCode | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(code: CurrencyCode) {
    setPending(code)
    setError(null)
    try {
      const updated = await setPreferredCurrency(code)
      navigate(updated.isAdmin ? '/home' : '/dashboard', { replace: true })
    } catch {
      setError('Could not save your currency — try again.')
      setPending(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 [background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.16),transparent_70%)] dark:bg-neutral-950 dark:[background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.10),transparent_70%)]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            Finance Management
          </p>
          <BrandLockup className="mt-3 justify-center" markClassName="h-11 w-11" />
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            Which currency should your loans be shown in? You can change this anytime from the header.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

          {error && (
            <p className="relative mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUPPORTED_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                disabled={pending !== null}
                onClick={() => handleSelect(code)}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-violet-700 dark:hover:bg-violet-500/10"
              >
                <img
                  src={CURRENCY_FLAG_SRC[code]}
                  alt=""
                  className="h-4 w-[1.333rem] shrink-0 rounded-[2px] object-cover ring-1 ring-black/5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {code}
                  </span>
                  <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {currencyName(code)}
                  </span>
                </span>
                {pending === code && (
                  <span className="ml-auto shrink-0 text-xs text-violet-500 dark:text-violet-400">Saving…</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
