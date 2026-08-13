import type {
  AuthUser,
  CashFlowMonthlySummary,
  CashFlowTrendSummary,
  Category,
  CategoryInput,
  LedgerTransaction,
  Loan,
  LoanDetail,
  LoanInput,
  LoanScheduleItem,
  MonthlyRoutineSummary,
  RecurringExpense,
  RecurringExpenseInput,
  RecurringExpenseUpdateInput,
  RecurringIncome,
  RecurringIncomeInput,
  RecurringIncomeUpdateInput,
  SavingPot,
  SavingPotAdjustInput,
  SavingPotHistoryPage,
  SavingPotInput,
  TransactionInput,
  TransactionType,
  WeeklyExpenseBatchInput,
} from './types'
import type { CurrencyCode } from './lib/currency'

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
    const detail =
      body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string' ? body.detail : null
    throw new ApiError(res.status, detail ?? `Request failed: ${res.status}`)
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

export function updateLoan(id: string, input: LoanInput): Promise<Loan> {
  return authedRequest<Loan>(`${LOANS_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteLoan(id: string): Promise<void> {
  return authedRequest<void>(`${LOANS_URL}/${id}`, { method: 'DELETE' })
}

export function fetchLoanDetail(id: string): Promise<LoanDetail> {
  return authedRequest<LoanDetail>(`${LOANS_URL}/${id}`)
}

export function fetchLoanSchedule(id: string): Promise<LoanScheduleItem[]> {
  return authedRequest<LoanScheduleItem[]>(`${LOANS_URL}/${id}/schedule`)
}

const CATEGORIES_URL = '/api/categories'
const TRANSACTIONS_URL = '/api/transactions'

export function fetchCategories(includeInactive = false): Promise<Category[]> {
  const query = new URLSearchParams({ includeInactive: String(includeInactive) })
  return authedRequest<Category[]>(`${CATEGORIES_URL}?${query}`)
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return authedRequest<Category>(CATEGORIES_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCategory(
  id: string,
  input: Partial<CategoryInput> & { isActive?: boolean },
): Promise<Category> {
  return authedRequest<Category>(`${CATEGORIES_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteCategory(id: string): Promise<void> {
  return authedRequest<void>(`${CATEGORIES_URL}/${id}`, { method: 'DELETE' })
}

interface TransactionFilters {
  year: number
  month: number
  type?: TransactionType
  categoryId?: string
}

export function fetchTransactions(filters: TransactionFilters): Promise<LedgerTransaction[]> {
  const query = new URLSearchParams({ year: String(filters.year), month: String(filters.month) })
  if (filters.type) query.set('type', filters.type)
  if (filters.categoryId) query.set('categoryId', filters.categoryId)
  return authedRequest<LedgerTransaction[]>(`${TRANSACTIONS_URL}?${query}`)
}

export function createTransaction(input: TransactionInput): Promise<LedgerTransaction> {
  return authedRequest<LedgerTransaction>(TRANSACTIONS_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createWeeklyExpenses(
  input: WeeklyExpenseBatchInput,
): Promise<LedgerTransaction[]> {
  return authedRequest<LedgerTransaction[]>(`${TRANSACTIONS_URL}/weekly-expenses`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTransaction(id: string, input: TransactionInput): Promise<LedgerTransaction> {
  return authedRequest<LedgerTransaction>(`${TRANSACTIONS_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteTransaction(id: string): Promise<void> {
  return authedRequest<void>(`${TRANSACTIONS_URL}/${id}`, { method: 'DELETE' })
}

export function fetchCashFlowSummary(
  year: number,
  month: number,
  currency: CurrencyCode,
): Promise<CashFlowMonthlySummary> {
  const query = new URLSearchParams({ year: String(year), month: String(month), currency })
  return authedRequest<CashFlowMonthlySummary>(`/api/cashflow/summary?${query}`)
}

export function fetchCashFlowTrend(
  endYear: number,
  endMonth: number,
  months: 6 | 12,
  currency: CurrencyCode,
): Promise<CashFlowTrendSummary> {
  const query = new URLSearchParams({
    endYear: String(endYear),
    endMonth: String(endMonth),
    months: String(months),
    currency,
  })
  return authedRequest<CashFlowTrendSummary>(`/api/cashflow/trend?${query}`)
}

const RECURRING_EXPENSES_URL = '/api/recurring-expenses'

export function fetchRecurringExpenses(): Promise<RecurringExpense[]> {
  return authedRequest<RecurringExpense[]>(RECURRING_EXPENSES_URL)
}

export function createRecurringExpense(input: RecurringExpenseInput): Promise<RecurringExpense> {
  return authedRequest<RecurringExpense>(RECURRING_EXPENSES_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRecurringExpense(
  id: string,
  input: RecurringExpenseUpdateInput,
): Promise<RecurringExpense> {
  return authedRequest<RecurringExpense>(`${RECURRING_EXPENSES_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deactivateRecurringExpense(
  id: string,
  effectiveFromMonth: string,
): Promise<RecurringExpense> {
  return authedRequest<RecurringExpense>(`${RECURRING_EXPENSES_URL}/${id}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ effectiveFromMonth }),
  })
}

export function reactivateRecurringExpense(
  id: string,
  resumeFromMonth: string,
): Promise<RecurringExpense> {
  return authedRequest<RecurringExpense>(`${RECURRING_EXPENSES_URL}/${id}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ resumeFromMonth }),
  })
}

const RECURRING_INCOMES_URL = '/api/recurring-incomes'

export function fetchRecurringIncomes(): Promise<RecurringIncome[]> {
  return authedRequest<RecurringIncome[]>(RECURRING_INCOMES_URL)
}

export function createRecurringIncome(input: RecurringIncomeInput): Promise<RecurringIncome> {
  return authedRequest<RecurringIncome>(RECURRING_INCOMES_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRecurringIncome(
  id: string,
  input: RecurringIncomeUpdateInput,
): Promise<RecurringIncome> {
  return authedRequest<RecurringIncome>(`${RECURRING_INCOMES_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deactivateRecurringIncome(
  id: string,
  effectiveFromMonth: string,
): Promise<RecurringIncome> {
  return authedRequest<RecurringIncome>(`${RECURRING_INCOMES_URL}/${id}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ effectiveFromMonth }),
  })
}

export function reactivateRecurringIncome(
  id: string,
  resumeFromMonth: string,
): Promise<RecurringIncome> {
  return authedRequest<RecurringIncome>(`${RECURRING_INCOMES_URL}/${id}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ resumeFromMonth }),
  })
}

export function fetchMonthlyRoutine(
  year: number,
  month: number,
  currency: CurrencyCode,
): Promise<MonthlyRoutineSummary> {
  const query = new URLSearchParams({ year: String(year), month: String(month), currency })
  return authedRequest<MonthlyRoutineSummary>(`/api/monthly-routine?${query}`)
}

const SAVING_POT_URL = '/api/saving-pot'

export async function fetchSavingPot(): Promise<SavingPot | null> {
  try {
    return await authedRequest<SavingPot>(SAVING_POT_URL)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export function upsertSavingPot(input: SavingPotInput): Promise<SavingPot> {
  return authedRequest<SavingPot>(SAVING_POT_URL, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function adjustSavingPot(input: SavingPotAdjustInput): Promise<SavingPot> {
  return authedRequest<SavingPot>(`${SAVING_POT_URL}/adjust`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchSavingPotHistory(
  limit = 50,
  offset = 0,
): Promise<SavingPotHistoryPage> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return authedRequest<SavingPotHistoryPage>(`${SAVING_POT_URL}/history?${query}`)
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

export function login(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_URL}/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
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

export function createUser(username: string, password: string, isAdmin: boolean): Promise<AuthUser> {
  return authedRequest<AuthUser>(`${AUTH_URL}/users`, {
    method: 'POST',
    body: JSON.stringify({ username, password, isAdmin }),
  })
}

export function deleteUser(id: string): Promise<void> {
  return authedRequest<void>(`${AUTH_URL}/users/${id}`, { method: 'DELETE' })
}

export function setPreferredCurrency(currency: string): Promise<AuthUser> {
  return authedRequest<AuthUser>(`${AUTH_URL}/currency`, {
    method: 'PATCH',
    body: JSON.stringify({ currency }),
  })
}
