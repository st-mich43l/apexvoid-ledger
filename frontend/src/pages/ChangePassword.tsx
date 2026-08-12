import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLockup } from '../components/BrandMark'
import { useAuth } from '../context/AuthContext'

export function ChangePasswordPage() {
  const { changePassword } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const updated = await changePassword(currentPassword, newPassword)
      navigate(updated.isAdmin ? '/home' : '/dashboard', { replace: true })
    } catch {
      setError('Current password is incorrect.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 [background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.16),transparent_70%)] dark:bg-neutral-950 dark:[background-image:radial-gradient(60%_50%_at_50%_-10%,rgba(139,92,246,0.10),transparent_70%)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            Finance Management
          </p>
          <BrandLockup className="mt-3 justify-center" markClassName="h-11 w-11" />
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            You're signed in with a temporary password. Set a new one to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

          <div className="relative flex flex-col gap-4">
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Current password
              </label>
              <input
                required
                autoFocus
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">New password</label>
              <input
                required
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Confirm new password
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
            >
              {submitting ? 'Saving…' : 'Save new password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'
