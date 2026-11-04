import { expect, test } from '@playwright/test'

const user = { id: 'privacy-test', username: 'alice', isAdmin: false, mustChangePassword: false, preferredCurrency: 'VND', createdAt: '2026-01-01T00:00:00Z' }
const summary = { year: 2026, month: 11, currency: 'VND', income: 25521658, expenses: 12000000, netCashFlow: 13521658, savingsRatePercent: 53, transactionCount: 0, recurringIncomeTotal: 0, recurringIncomeCount: 0, recurringIncomes: [], loanPaymentCount: 0, loanPayments: [], fixedExpenseTotal: 0, fixedExpenseCount: 0, variableExpenseTotal: 0, loanPaymentTotal: 0, committedExpenseTotal: 0, recurringExpenses: [], categoryBreakdown: [], convertedCurrencies: [], unconvertedCurrencies: [], conversionRates: [], exchangeRateProvider: null, exchangeRateProviderUrl: null, excludedCurrencies: [] }

test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path === '/api/auth/me') body = user
    else if (path === '/api/cashflow/summary') body = summary
    else if (path === '/api/notifications/unread-count') body = { count: 0 }
    else if (path === '/api/net-worth/summary') body = { reportingCurrency: 'VND', totalAssets: 100000000, totalLiabilities: 50000000, netWorth: 50000000, conversionComplete: true, valuationComplete: true, assetBreakdown: [], liabilityBreakdown: [], warnings: [], lastUpdatedAt: null }
    else if (path === '/api/bank-activities/categorization-rule') body = { financialAccountId: 'account', enabled: false, categoryId: null, categoryName: null, descriptionContains: null, referenceContains: null }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
})

test('hides and restores amounts across navigation and reload without losing input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cashflow')
  const toggle = page.getByRole('button', { name: 'Hide monetary amounts' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.financial-amount').filter({ hasText: '₫25,521,658' })).toBeVisible()
  await page.getByText('Search & filters').click()
  await page.getByRole('textbox', { name: 'Search activity' }).fill('coffee')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('₫25,521,658', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Search activity' })).toHaveValue('coffee')
  await expect(page.locator('[aria-label*="25,521,658"], [title*="25,521,658"]')).toHaveCount(0)
  await page.getByRole('link', { name: 'Net Worth', exact: true }).click()
  await expect(page.getByText('₫100,000,000', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('₫100,000,000', { exact: true })).toHaveCount(0)
  await toggle.click()
  await expect(page.getByText('₫100,000,000', { exact: true })).toBeVisible()
})

test('desktop chart labels and other tabs update when money is hidden', async ({ page, context }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/cashflow')
  await expect(page.getByLabel(/Income ₫25,521,658; expenses/)).toBeVisible()
  const second = await context.newPage()
  await second.setViewportSize({ width: 1920, height: 1080 })
  await second.goto('/cashflow')
  await page.getByRole('button', { name: 'Hide monetary amounts' }).click()
  await expect(page.getByLabel(/Income ₫25,521,658; expenses/)).toHaveCount(0)
  await expect(page.getByLabel(/Income ••••; expenses ••••/)).toBeVisible()
  await expect(second.getByRole('button', { name: 'Hide monetary amounts' })).toHaveAttribute('aria-pressed', 'true')
  await expect(second.getByText('₫25,521,658', { exact: true })).toHaveCount(0)
})
