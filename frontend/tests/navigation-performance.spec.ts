import { expect, test, type Page } from '@playwright/test'

const user = { id: 'nav-cache-user', username: 'navcache', isAdmin: false, mustChangePassword: false, preferredCurrency: 'VND', createdAt: '2026-01-01T00:00:00Z' }
const summary = {
  year: 2026, month: 11, currency: 'VND', income: 85000000, expenses: 67733909, netCashFlow: 17266091,
  savingsRatePercent: 20, transactionCount: 0, recurringIncomeTotal: 0, recurringIncomeCount: 0, recurringIncomes: [],
  loanPaymentCount: 0, loanPayments: [], fixedExpenseTotal: 0, fixedExpenseCount: 0, variableExpenseTotal: 0,
  loanPaymentTotal: 0, committedExpenseTotal: 0, recurringExpenses: [], categoryBreakdown: [], convertedCurrencies: [],
  unconvertedCurrencies: [], conversionRates: [], exchangeRateProvider: null, exchangeRateProviderUrl: null, excludedCurrencies: [],
}

async function stubApi(page: Page) {
  const counts = new Map<string, number>()
  let transactionCreated = false
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    counts.set(path, (counts.get(path) ?? 0) + 1)
    let body: unknown = []
    if (path === '/api/auth/me') body = user
    else if (path === '/api/transactions' && route.request().method() === 'POST') {
      transactionCreated = true
      body = { id: 'transaction-1', type: 'expense', categoryId: 'food', categoryName: 'Food', categoryIcon: '🍜', amount: 5000000, currency: 'VND', occurredAt: '2026-11-05', description: 'Test expense', source: 'manual', createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z' }
    } else if (path === '/api/categories') body = [{ id: 'food', name: 'Food', type: 'expense', icon: '🍜', isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }]
    else if (path === '/api/cashflow/summary') body = { ...summary, expenses: transactionCreated ? 65000000 : summary.expenses, netCashFlow: transactionCreated ? 20000000 : summary.netCashFlow }
    else if (path === '/api/cashflow/trend') body = { startYear: 2026, startMonth: 6, endYear: 2026, endMonth: 11, monthCount: 6, currency: 'VND', points: [], convertedCurrencies: [], unconvertedCurrencies: [], exchangeRateProvider: null, exchangeRateProviderUrl: null }
    else if (path === '/api/net-worth/summary') body = { reportingCurrency: 'VND', totalAssets: 25_000_000, totalLiabilities: 10_000_000, netWorth: 15_000_000, conversionComplete: true, valuationComplete: true, assetBreakdown: [], liabilityBreakdown: [], warnings: [], lastUpdatedAt: null }
    else if (path === '/api/monthly-budget') body = { year: 2026, month: 11, hasBudget: false, currency: 'VND', incomeTotal: 0, expenseTotal: 0, allocations: [], unconvertedCurrencies: [] }
    else if (path === '/api/monthly-close') body = { year: 2026, month: 10, status: 'ready_to_close', latestSnapshot: null, blockers: [], current: { conversionComplete: true, hasBudget: false, manualTransactionCount: 0, scheduledIncomeCount: 0, fixedExpenseCount: 0, loanPaymentCount: 0, incomeTotal: 0, expenseTotal: 0 } }
    else if (path === '/api/monthly-routine') body = { year: 2026, month: 11, currency: 'VND', expectedIncomeTotal: 0, committedExpenseTotal: 0, loanPaymentTotal: 0, projectedRemainder: 0, recurringIncomes: [], recurringExpenses: [], unconvertedCurrencies: [] }
    else if (path === '/api/notifications/unread-count') body = { count: 0 }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  return counts
}

test('mobile revisits reuse account-scoped summary and net-worth cache', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') })
  const counts = await stubApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await expect(page.getByRole('region', { name: 'Financial position' })).toBeVisible()
  await expect.poll(() => counts.get('/api/cashflow/summary')).toBe(1)
  await expect.poll(() => counts.get('/api/net-worth/summary')).toBe(1)
  expect(counts.get('/api/cashflow/trend') ?? 0).toBe(0)
  expect(counts.get('/api/monthly-budget') ?? 0).toBe(0)
  expect(counts.get('/api/monthly-routine') ?? 0).toBe(0)
  await page.evaluate(() => {
    const perfWindow = window as Window & { __navTapAt?: number; __navResponseMs?: number | undefined }
    document.addEventListener('click', event => {
      const anchor = (event.target as HTMLElement).closest('nav[aria-label="Mobile navigation"] a')
      if (!anchor) return
      perfWindow.__navTapAt = performance.now()
      perfWindow.__navResponseMs = undefined
      const observer = new MutationObserver(() => {
        if (anchor.getAttribute('aria-current') === 'page' && perfWindow.__navTapAt !== undefined) {
          const startedAt = perfWindow.__navTapAt
          observer.disconnect()
          requestAnimationFrame(() => requestAnimationFrame(() => { perfWindow.__navResponseMs = performance.now() - startedAt }))
        }
      })
      observer.observe(anchor, { attributes: true, attributeFilter: ['aria-current'] })
    }, true)
  })

  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Cash Flow' }).click()
  await expect(page.getByRole('heading', { name: 'Monthly overview' })).toBeVisible()
  const tapFeedbackMs = await page.evaluate(() => (window as Window & { __navResponseMs?: number }).__navResponseMs)
  expect(tapFeedbackMs).toBeLessThan(500)
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Net Worth' }).click()
  await expect(page.getByRole('heading', { name: 'Net Worth' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('region', { name: 'Financial position' })).toBeVisible()

  expect(counts.get('/api/cashflow/summary')).toBe(1)
  expect(counts.get('/api/net-worth/summary')).toBe(1)
  expect(counts.get('/api/net-worth/accounts')).toBe(1)
  test.info().annotations.push({ type: 'measured-navigation', description: `Mobile active-tab feedback: ${tapFeedbackMs?.toFixed(1)}ms; cached revisit financial API requests: 0 for the shared summaries.` })
  console.log(JSON.stringify({ tapFeedbackMs, requestCounts: Object.fromEntries(counts), cachedSummaryRequestsAfterReturn: 0 }))
})

test('mobile Dashboard defers its secondary trend request until insights open', async ({ page }) => {
  const counts = await stubApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await expect(page.getByRole('region', { name: 'Financial position' })).toBeVisible()
  expect(counts.get('/api/cashflow/trend') ?? 0).toBe(0)
  await page.getByText('More financial insights').click()
  await expect(page.getByRole('heading', { name: 'Financial trends' })).toBeVisible()
  await expect.poll(() => counts.get('/api/cashflow/trend')).toBe(1)
  await expect.poll(() => counts.get('/api/monthly-budget')).toBe(1)
  await expect.poll(() => counts.get('/api/monthly-routine')).toBe(1)
})

test('switching accounts never reuses another account financial query cache', async ({ page }) => {
  let activeUser = 1
  let summaryRequests = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path === '/api/auth/me') body = activeUser === 1 ? user : { ...user, id: 'second-user', username: 'second' }
    else if (path === '/api/auth/logout') { activeUser = 0; await route.fulfill({ status: 204 }); return }
    else if (path === '/api/auth/login') { activeUser = 2; body = { ...user, id: 'second-user', username: 'second' } }
    else if (path === '/api/cashflow/summary') {
      summaryRequests += 1
      body = { ...summary, income: activeUser === 2 ? 99_000_000 : 85_000_000 }
    } else if (path === '/api/net-worth/summary') body = { reportingCurrency: 'VND', totalAssets: activeUser === 2 ? 90_000_000 : 25_000_000, totalLiabilities: 0, netWorth: activeUser === 2 ? 90_000_000 : 25_000_000, conversionComplete: true, valuationComplete: true, assetBreakdown: [], liabilityBreakdown: [], warnings: [], lastUpdatedAt: null }
    else if (path === '/api/notifications/unread-count') body = { count: 0 }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cashflow?year=2026&month=11')
  await expect(page.getByText('₫85,000,000').first()).toBeVisible()
  await page.getByRole('button', { name: 'Account menu for navcache' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page.locator('input[type="text"]')).toBeVisible()
  await page.locator('input[type="text"]').fill('second')
  await page.locator('input[type="password"]').fill('unused-test-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Monthly overview' })).toBeVisible()
  expect(summaryRequests).toBe(2)
  await expect(page.getByText('₫99,000,000').first()).toBeVisible()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('region', { name: 'Financial position' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Cash Flow' }).click()
  await expect(page.getByText('₫99,000,000').first()).toBeVisible()
  expect(summaryRequests).toBe(2)
})

test('creating a transaction refreshes shared cash-flow data for Dashboard', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') })
  const counts = await stubApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await expect(page.getByRole('region', { name: 'Financial position' })).toBeVisible()
  await expect.poll(() => counts.get('/api/cashflow/summary')).toBe(1)
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Cash Flow' }).click()
  await page.getByRole('button', { name: 'Add transaction' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add transaction' })
  await dialog.getByLabel('Category').selectOption('food')
  await dialog.getByLabel('Amount').fill('5000000')
  await dialog.getByLabel(/Description/).fill('Test expense')
  await dialog.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await expect.poll(() => counts.get('/api/cashflow/summary')).toBe(2)
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('region', { name: 'Financial position' }).getByText('₫65,000,000')).toBeVisible()
  expect(counts.get('/api/cashflow/summary')).toBe(2)
})
