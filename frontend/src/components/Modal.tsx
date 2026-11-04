import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  onClose: () => void
  label: string
  children: React.ReactNode
  dismissible?: boolean
  variant?: 'dialog' | 'drawer'
  matte?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true',
  )
}

// Reusable dialog shell (edit/delete confirmations, and future modals) with
// native focus management. Callers can block Escape/backdrop dismissal during
// an in-flight action without replacing onClose with an unstable no-op.
export function Modal({ onClose, label, children, dismissible = true, variant = 'dialog', matte = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = previouslyFocusedRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (dialog) {
      const explicitTarget = dialog.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
      const target = explicitTarget ?? getFocusableElements(dialog)[0] ?? dialog
      target.focus()
    }

    return () => {
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (dismissible) onClose()
        return
      }

      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = getFocusableElements(dialog)
      if (focusable.length === 0) {
        e.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const focusIsOutside = !dialog.contains(active)

      if (e.shiftKey && (active === first || active === dialog || focusIsOutside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || active === dialog || focusIsOutside)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissible, onClose])

  return createPortal(
    <div className={variant === 'drawer' ? 'fixed inset-0 z-50' : 'fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4'}>
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`${matte ? 'matte-glass' : 'border border-ledger-border bg-ledger-elevated shadow-2xl'} ${variant === 'drawer'
          ? 'relative h-full w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-5 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-16'
          : 'relative max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-t-[var(--ledger-radius-modal)] p-5 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-h-[90vh] sm:rounded-[var(--ledger-radius-modal)] sm:p-7 sm:pt-16'}`}
      >
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${label}`}
            className="absolute top-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-[var(--ledger-radius-control)] text-ledger-text-secondary transition-colors hover:bg-ledger-subtle hover:text-ledger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-primary sm:top-4 sm:right-4"
          >
            <CloseIcon />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
}
