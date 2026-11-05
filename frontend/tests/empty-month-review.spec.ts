import { expect, test, type Page } from '@playwright/test'

const emptyClose = {
  year: 2026, month: 10, status: 'ready_to_close', closeEligible: true, recloseEligible: false,
  current: { reportingCurrency: 'VND', scheduledIncomeTotal: 0, manualIncomeTotal: 0, incomeTotal: 0,
    fixedExpenseTotal: 0, variableExpenseTotal: 0, loanPaymentTotal: 0, expenseTotal: 0, netCashFlow: 0,
    manualTransactionCount: 0, scheduledIncomeCount: 0, fixedExpenseCount: 0, loanPaymentCount: 0,
    hasBudget: false, conversionComplete: true, unconvertedCurrencies: [], savingPotStatus: 'stale' },
  latestSnapshot: null, hasDrift: false, driftFields: [], differences: [], history: [], blockers: [], lastDay: '2026-10-31',
}

async function mockApis(page: Page, close: unknown) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path === '/api/auth/me') body = { id: 'test', username: 'admin', isAdmin: true, mustChangePassword: false, preferredCurrency: 'VND', createdAt: '2026-01-01T00:00:00Z' }
    else if (path === '/api/monthly-close') body = close
    else if (path === '/api/monthly-budget') body = { hasBudget: false, unconvertedCurrencies: [] }
    else if (path === '/api/monthly-routine') body = { currency: 'VND', unconvertedCurrencies: [], expectedIncomeTotal: 0, committedExpenseTotal: 0, loanPaymentTotal: 0, projectedRemainder: 0 }
    else if (path === '/api/net-worth/summary') body = { reportingCurrency: 'VND', totalAssets: 0, totalLiabilities: 0, netWorth: 0, valuationComplete: true, warnings: [], assetBreakdown: [], liabilityBreakdown: [], lastUpdatedAt: null }
    else if (path === '/api/cashflow/summary') body = { currency: 'VND', income: 0, expenses: 0, netCashFlow: 0, categoryBreakdown: [], unconvertedCurrencies: [] }
    else if (path === '/api/notifications/unread-count') body = { count: 0 }
    else if (path === '/api/cashflow/trend') { await route.fulfill({ status: 503 }); return }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test('empty unclosed October has no review request or historical details', async ({ page }) => {
  await mockApis(page, emptyClose)
  await page.goto('/monthly-close?year=2026&month=10')
  await expect(page.getByText(/No cash-flow activity or budget was recorded for October 2026/)).toBeVisible()
  await expect(page.getByText('Needs review', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'What changed' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Close October/ })).toHaveCount(0)
})

test('dashboard omits empty-month review but keeps alerts for actual activity', async ({ page }) => {
  await mockApis(page, emptyClose)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  const attention = page.getByRole('heading', { name: 'Financial Attention' }).locator('xpath=ancestor::article[1]')
  await expect(attention).toBeVisible()
  await expect(attention.getByText('All clear.')).toBeVisible()
  await expect(attention.getByText('Previous month is ready to close')).toHaveCount(0)
  await page.route('**/api/monthly-close?**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...emptyClose, current: { ...emptyClose.current, manualTransactionCount: 1, incomeTotal: 100 } }) })
  })
  await page.reload()
  await expect(attention.getByText('Previous month is ready to close')).toBeVisible()
  await page.route('**/api/monthly-close?**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...emptyClose, status: 'needs_review', latestSnapshot: { revisionNumber: 2 } }) })
  })
  await page.reload()
  await expect(attention.getByText('Previous month changed after close')).toBeVisible()
})
