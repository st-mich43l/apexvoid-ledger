import type { Loan, LoanInput } from './types'

const BASE_URL = '/api/loans'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export function fetchLoans(): Promise<Loan[]> {
  return request<Loan[]>(BASE_URL)
}

export function createLoan(input: LoanInput): Promise<Loan> {
  return request<Loan>(BASE_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteLoan(id: string): Promise<void> {
  return request<void>(`${BASE_URL}/${id}`, { method: 'DELETE' })
}
