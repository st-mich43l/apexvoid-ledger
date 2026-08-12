import { useEffect, useState, type FormEvent } from 'react'
import { createUser, deleteUser, fetchUsers } from '../../api'
import { useAuth } from '../../context/AuthContext'
import type { AuthUser } from '../../types'

const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setUsers(await fetchUsers())
      setError(null)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">User accounts</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Only admins can see this page. New accounts start with a temporary password that must be changed
          on first login.
        </p>
      </div>

      {error && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mb-6">
        <CreateUserForm onCreated={load} />
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <UsersTable users={users} currentUserId={currentUser?.id} onChange={load} />
      )}
    </section>
  )
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createUser(username, password, isAdmin)
      setUsername('')
      setPassword('')
      setIsAdmin(false)
      onCreated()
    } catch {
      setError('Could not create user — username may already be in use.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] sm:p-7 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />

      {error && (
        <p className="relative mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Username</label>
          <input
            required
            type="text"
            minLength={3}
            pattern="[a-zA-Z0-9_.-]+"
            title="Letters, numbers, underscore, dot, and hyphen only"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="family"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Temporary password</label>
          <input
            required
            type="text"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 dark:border-neutral-700"
          />
          Admin
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </div>
    </form>
  )
}

function UsersTable({
  users,
  currentUserId,
  onChange,
}: {
  users: AuthUser[]
  currentUserId: string | undefined
  onChange: () => void
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-neutral-200/80 bg-white shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900/60">
          <tr>
            <Th>Username</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Created</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {users.map((user) => (
            <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} onChange={onChange} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserRow({ user, isSelf, onChange }: { user: AuthUser; isSelf: boolean; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    try {
      await deleteUser(user.id)
      onChange()
    } catch {
      setError('Could not delete this user.')
      setConfirming(false)
    }
  }

  return (
    <tr className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
      <Td className="font-medium text-neutral-900 dark:text-neutral-50">
        {user.username}
        {isSelf && <span className="ml-2 text-xs font-normal text-neutral-400 dark:text-neutral-500">(you)</span>}
      </Td>
      <Td>
        {user.isAdmin ? (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
            Admin
          </span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            User
          </span>
        )}
      </Td>
      <Td>
        {user.mustChangePassword ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            Pending first login
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            Active
          </span>
        )}
      </Td>
      <Td>{dateFormatter.format(new Date(user.createdAt))}</Td>
      <Td align="right">
        {error && <span className="mr-3 text-xs text-red-500">{error}</span>}
        {!isSelf && (
          <button
            onClick={handleDelete}
            onBlur={() => setConfirming(false)}
            className={
              confirming
                ? 'text-sm font-medium text-red-500 transition-colors'
                : 'text-sm text-neutral-400 transition-colors hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400'
            }
          >
            {confirming ? 'Click again to confirm' : 'Delete'}
          </button>
        )}
      </Td>
    </tr>
  )
}

const inputClass =
  'rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  )
}
