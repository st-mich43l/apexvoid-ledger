import type { AuthUser, Loan, LoanInput } from './types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Fires when an authenticated-assuming call comes back 401 — i.e. the session
// died mid-use (expired, revoked). NOT used for login/change-password, where a
// 401 just means "the credentials you typed were wrong," not "your session is
// gone" — AuthContext wires this to clear client-side user state so guarded
// routes redirect to /login instead of quietly failing.
let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.detail ?? `Request failed: ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

async function authedRequest<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    return await request<T>(url, options)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) onUnauthorized()
    throw err
  }
}

const LOANS_URL = '/api/loans'

export function fetchLoans(): Promise<Loan[]> {
  return authedRequest<Loan[]>(LOANS_URL)
}

export function createLoan(input: LoanInput): Promise<Loan> {
  return authedRequest<Loan>(LOANS_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteLoan(id: string): Promise<void> {
  return authedRequest<void>(`${LOANS_URL}/${id}`, { method: 'DELETE' })
}

const AUTH_URL = '/api/auth'

// Special-cased: a 401 here just means "not logged in yet" (the normal state
// on first load), not a session-died event — doesn't go through
// onUnauthorized, and resolves to null instead of throwing.
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>(`${AUTH_URL}/me`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

export function login(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_URL}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout(): Promise<void> {
  return request<void>(`${AUTH_URL}/logout`, { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_URL}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function fetchUsers(): Promise<AuthUser[]> {
  return authedRequest<AuthUser[]>(`${AUTH_URL}/users`)
}

export function createUser(email: string, password: string, isAdmin: boolean): Promise<AuthUser> {
  return authedRequest<AuthUser>(`${AUTH_URL}/users`, {
    method: 'POST',
    body: JSON.stringify({ email, password, isAdmin }),
  })
}

export function deleteUser(id: string): Promise<void> {
  return authedRequest<void>(`${AUTH_URL}/users/${id}`, { method: 'DELETE' })
}
