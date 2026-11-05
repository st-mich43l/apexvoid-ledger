import { expect, test } from '@playwright/test'

const user = { id: 'privacy-test', username: 'alice', isAdmin: false, mustChangePassword: false, preferredCurrency: 'VND', createdAt: '2026-01-01T00:00:00Z' }
const summary = { year: 2026, month: 11, currency: 'VND', income: 25521658, expenses: 12000000, netCashFlow: 13521658, savingsRatePercent: 53, transactionCount: 0, recurringIncomeTotal: 0, recurringIncomeCount: 0, recurringIncomes: [], loanPaymentCount: 0, loanPayments: [], fixedExpenseTotal: 0, fixedExpenseCount: 0, variableExpenseTotal: 0, loanPaymentTotal: 0, committedExpenseTotal: 0, recurringExpenses: [], categoryBreakdown: [], convertedCurrencies: [], unconvertedCurrencies: [], conversionRates: [], exchangeRateProvider: null, exchangeRateProviderUrl: null, excludedCurrencies: [] }

test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (['/api/monthly-routine', '/api/monthly-budget', '/api/monthly-close'].includes(path)) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Fixture unavailable' }) })
      return
    }
    let body: unknown = []
    if (path === '/api/auth/me') body = user
    else if (path === '/api/cashflow/summary') body = summary
    else if (path === '/api/cashflow/trend') body = { startYear: 2026, startMonth: 11, endYear: 2026, endMonth: 11, monthCount: 6, currency: 'VND', points: [{ year: 2026, month: 11, income: 25521658, expenses: 12000000, netCashFlow: 13521658, savingsRatePercent: 53, categoryBreakdown: [] }], convertedCurrencies: [], unconvertedCurrencies: [], exchangeRateProvider: null, exchangeRateProviderUrl: null }
    else if (path === '/api/notifications/unread-count') body = { count: 0 }
    else if (path === '/api/net-worth/summary') body = { reportingCurrency: 'VND', totalAssets: 100000000, totalLiabilities: 50000000, netWorth: 50000000, conversionComplete: true, valuationComplete: true, assetBreakdown: [], liabilityBreakdown: [], warnings: [], lastUpdatedAt: null }
    else if (path === '/api/bank-activities/categorization-rule') body = { financialAccountId: 'account', enabled: false, categoryId: null, categoryName: null, descriptionContains: null, referenceContains: null }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
})

test('inline controls independently hide and reveal amounts, including after hide all', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cashflow')
  const header = page.getByRole('button', { name: 'Hide monetary amounts', exact: true })
  const income = page.getByRole('button', { name: 'Hide monetary amounts (Income)', exact: true })
  const net = page.getByRole('button', { name: 'Hide monetary amounts (Net cash flow)', exact: true })
  await expect(income).toBeVisible()
  await expect(net).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hide monetary amounts (Savings rate)', exact: true })).toHaveCount(0)
  await income.click()
  await expect(header).toHaveAttribute('aria-pressed', 'false')
  await expect(income).toHaveAttribute('aria-pressed', 'true')
  await expect(net).toHaveAttribute('aria-pressed', 'false')
  await expect(income.locator('..').locator('..').locator('.financial-amount')).toHaveText('••••')
  await net.click()
  await expect(net).toHaveAttribute('aria-pressed', 'true')
  await income.click()
  await expect(income.locator('..').locator('..').locator('.financial-amount')).toHaveText('₫25,521,658')
  await expect(net).toHaveAttribute('aria-pressed', 'true')
  await header.click()
  await expect(income).toHaveAttribute('aria-pressed', 'true')
  await income.click()
  await expect(income.locator('..').locator('..').locator('.financial-amount')).toHaveText('₫25,521,658')
  await expect(net).toHaveAttribute('aria-pressed', 'true')
})

test('financial position eye hides and restores values on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  const position = page.getByRole('button', { name: 'Hide monetary amounts (Financial position)', exact: true })
  const amount = position.locator('..').getByText('₫50,000,000', { exact: true })
  await expect(position).toBeVisible()
  await expect(amount).toBeVisible()
  await position.click()
  await expect(position).toHaveAttribute('aria-pressed', 'true')
  await expect(position.locator('..').locator('.financial-amount')).toHaveText('••••')
  await position.click()
  await expect(amount).toBeVisible()
})

test('dashboard income, expenses, and net cash flow eyes work independently', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  const income = page.getByRole('button', { name: 'Hide monetary amounts (Monthly income)', exact: true })
  const expenses = page.getByRole('button', { name: 'Hide monetary amounts (Monthly expenses)', exact: true })
  const net = page.getByRole('button', { name: 'Hide monetary amounts (Net cash flow)', exact: true })
  await expect(income).toBeVisible()
  await income.click()
  await expect(income).toHaveAttribute('aria-pressed', 'true')
  await expect(expenses).toHaveAttribute('aria-pressed', 'false')
  await expect(net).toHaveAttribute('aria-pressed', 'false')
  await net.click()
  await expect(income).toHaveAttribute('aria-pressed', 'true')
  await expect(expenses).toHaveAttribute('aria-pressed', 'false')
  await expect(net).toHaveAttribute('aria-pressed', 'true')
})

for (const width of [320, 390, 430]) {
  test(`mobile dashboard amount eyes work independently at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/dashboard')
    const position = page.getByRole('region', { name: 'Financial position' })
    const eye = (label: string) => position.getByRole('button', { name: `Hide monetary amounts (${label})`, exact: true })
    const value = (label: string) => eye(label).locator('..').locator('..').locator('dd')
    await expect(value('Income')).toHaveText('₫25,521,658')
    await eye('Income').click()
    await expect(value('Income')).toHaveText('••••')
    await expect(value('Expenses')).toHaveText('₫12,000,000')
    await expect(value('Net cash flow')).toHaveText('₫13,521,658')
    await expect(value('Net worth')).toHaveText('₫50,000,000')
    await eye('Net worth').click()
    await expect(value('Net worth')).toHaveText('••••')
    await eye('Income').click()
    await expect(value('Income')).toHaveText('₫25,521,658')
    await expect(value('Net worth')).toHaveText('••••')
    await page.getByRole('button', { name: 'Hide monetary amounts', exact: true }).click()
    for (const label of ['Income', 'Expenses', 'Net cash flow', 'Net worth']) await expect(value(label)).toHaveText('••••')
    await eye('Net cash flow').click()
    await expect(value('Net cash flow')).toHaveText('₫13,521,658')
    await expect(value('Income')).toHaveText('••••')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('hides and restores amounts across navigation and reload without losing input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cashflow')
  const toggle = page.getByRole('button', { name: 'Hide monetary amounts', exact: true })
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
  await page.getByRole('button', { name: 'Hide monetary amounts', exact: true }).click()
  await expect(page.getByLabel(/Income ₫25,521,658; expenses/)).toHaveCount(0)
  await expect(page.getByLabel(/Income ••••; expenses ••••/)).toBeVisible()
  await expect(second.getByRole('button', { name: 'Hide monetary amounts', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(second.getByText('₫25,521,658', { exact: true })).toHaveCount(0)
})

test('dashboard chart privacy hides amounts and bars and remembers the choice across reloads and tabs', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  const chart = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Income vs expenses' }) })
  const eye = chart.getByRole('button', { name: 'Hide monetary amounts (Income vs expenses)', exact: true })
  await expect(chart.getByText('₫25,521,658', { exact: true })).toBeVisible()
  await eye.click()
  await expect(chart.getByText('Chart hidden for privacy. Use the eye to show it.')).toBeVisible()
  await expect(chart.getByText('₫25,521,658', { exact: true })).toHaveCount(0)
  await expect(chart.locator('svg[role="group"]')).toHaveCount(0)
  await page.reload()
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  await expect(chart.getByText('Chart hidden for privacy. Use the eye to show it.')).toBeVisible()
  const second = await context.newPage()
  await second.setViewportSize({ width: 1440, height: 900 })
  await second.goto('/dashboard')
  const secondEye = second.getByRole('button', { name: 'Hide monetary amounts (Income vs expenses)', exact: true })
  await expect(secondEye).toHaveAttribute('aria-pressed', 'true')
  await secondEye.click()
  await expect(eye).toHaveAttribute('aria-pressed', 'false')
  await expect(chart.getByText('₫25,521,658', { exact: true })).toBeVisible()
})

test('individual card privacy choices persist until the global control resets them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cashflow')
  const income = page.getByRole('button', { name: 'Hide monetary amounts (Income)', exact: true })
  const expenses = page.getByRole('button', { name: 'Hide monetary amounts (Expenses)', exact: true })
  await income.click()
  await page.reload()
  await expect(income).toHaveAttribute('aria-pressed', 'true')
  await expect(expenses).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Hide monetary amounts', exact: true }).click()
  await expect(expenses).toHaveAttribute('aria-pressed', 'true')
  await income.click()
  await page.reload()
  await expect(income).toHaveAttribute('aria-pressed', 'false')
  await expect(expenses).toHaveAttribute('aria-pressed', 'true')
})
