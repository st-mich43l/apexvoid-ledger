import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCurrency } from '../context/CurrencyContext'
import { currencyName, SUPPORTED_CURRENCIES, type CurrencyCode } from '../lib/currency'
import { CURRENCY_FLAG_SRC } from '../lib/flags'

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }

  useEffect(() => {
    if (!open) return

    updatePosition()

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  function handleSelect(code: CurrencyCode) {
    setCurrency(code)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Display currency"
        className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white py-0 pr-3 pl-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
      >
        <FlagImg code={currency} />
        {currency}
        <ChevronDownIcon className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
      </button>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-label="Display currency"
            style={{ top: menuPos.top, right: menuPos.right }}
            className="fixed z-50 w-48 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white py-1.5 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <li key={code} role="option" aria-selected={code === currency}>
                <button
                  type="button"
                  onClick={() => handleSelect(code)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                    code === currency
                      ? 'font-medium text-violet-600 dark:text-violet-400'
                      : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  <FlagImg code={code} />
                  <span className="font-medium">{code}</span>
                  <span className="truncate text-neutral-400 dark:text-neutral-500">{currencyName(code)}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}

function FlagImg({ code }: { code: CurrencyCode }) {
  return (
    <img
      src={CURRENCY_FLAG_SRC[code]}
      alt=""
      className="h-3.5 w-[1.166667rem] shrink-0 rounded-[2px] object-cover ring-1 ring-black/5"
    />
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}
