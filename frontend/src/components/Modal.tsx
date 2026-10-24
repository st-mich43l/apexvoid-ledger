import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  onClose: () => void
  label: string
  children: React.ReactNode
  dismissible?: boolean
  variant?: 'dialog' | 'drawer'
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
export function Modal({ onClose, label, children, dismissible = true, variant = 'dialog' }: ModalProps) {
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
    <div className={variant === 'drawer' ? 'fixed inset-0 z-50' : 'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4'}>
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
        className={variant === 'drawer'
          ? 'relative h-full w-[min(24rem,calc(100vw-1rem))] overflow-y-auto border-r border-ledger-border bg-ledger-elevated p-5 shadow-2xl sm:p-6'
          : 'relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--ledger-radius-modal)] border border-ledger-border bg-ledger-elevated p-6 shadow-2xl sm:p-7'}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
