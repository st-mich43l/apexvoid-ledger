import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  onClose: () => void
  label: string
  children: React.ReactNode
}

// Reusable dialog shell (edit/delete confirmations, and future modals) —
// portal to <body>, Escape-to-close, backdrop-click-to-close, focus scoped
// via aria-modal. `onClose` is a no-op while an action is in flight
// (callers pass e.g. `saving ? () => {} : close` to block dismissal then).
export function Modal({ onClose, label, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm dark:bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_8px_24px_-4px_rgba(24,16,54,0.2)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
