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
        className="flex h-9 items-center gap-2 rounded-[var(--ledger-radius-control)] border border-ledger-border bg-ledger-elevated py-0 pr-3 pl-2.5 text-sm font-medium text-ledger-text-secondary transition-colors hover:bg-ledger-subtle hover:text-ledger-text"
      >
        <FlagImg code={currency} />
        {currency}
        <ChevronDownIcon className="h-3.5 w-3.5 text-ledger-muted" />
      </button>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-label="Display currency"
            style={{ top: menuPos.top, right: menuPos.right }}
            className="fixed z-50 w-48 overflow-hidden rounded-[var(--ledger-radius-card)] border border-ledger-border bg-ledger-elevated py-1.5 shadow-[var(--ledger-shadow-card)]"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <li key={code} role="option" aria-selected={code === currency}>
                <button
                  type="button"
                  onClick={() => handleSelect(code)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-ledger-subtle ${
                    code === currency
                      ? 'font-medium text-ledger-primary'
                      : 'text-ledger-text-secondary'
                  }`}
                >
                  <FlagImg code={code} />
                  <span className="font-medium">{code}</span>
                  <span className="truncate text-ledger-muted">{currencyName(code)}</span>
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
