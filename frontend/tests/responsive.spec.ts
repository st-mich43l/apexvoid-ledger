import { expect, test, type Page } from '@playwright/test'

const user = {
  id: 'responsive-test-user',
  username: 'responsive',
  isAdmin: true,
  mustChangePassword: false,
  preferredCurrency: 'VND',
  createdAt: '2026-01-01T00:00:00Z',
}

const cashFlowSummary = {
  year: 2026,
  month: 11,
  currency: 'VND',
  income: 25521658,
  expenses: 12000000,
  netCashFlow: 13521658,
  savingsRatePercent: 53,
  transactionCount: 0,
  recurringIncomeTotal: 0,
  recurringIncomeCount: 0,
  recurringIncomes: [],
  loanPaymentCount: 0,
  loanPayments: [],
  fixedExpenseTotal: 0,
  fixedExpenseCount: 0,
  variableExpenseTotal: 0,
  loanPaymentTotal: 0,
  committedExpenseTotal: 0,
  recurringExpenses: [],
  categoryBreakdown: [],
  convertedCurrencies: [],
  unconvertedCurrencies: [],
  conversionRates: [],
  exchangeRateProvider: null,
  exchangeRateProviderUrl: null,
  excludedCurrencies: [],
}

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/auth/me'
      ? user
      : path === '/api/cashflow/summary'
        ? cashFlowSummary
        : path === '/api/bank-activities/categorization-rule'
          ? { financialAccountId: 'account-1', enabled: false, categoryId: null, categoryName: null, descriptionContains: null, referenceContains: null }
          : []
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function expectViewportContained(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

const viewports = [
  { name: '320×568', width: 320, height: 568 },
  { name: '360×800', width: 360, height: 800 },
  { name: '375×812', width: 375, height: 812 },
  { name: '390×844', width: 390, height: 844 },
  { name: '430×932', width: 430, height: 932 },
  { name: '768×1024', width: 768, height: 1024 },
  { name: '1024×768', width: 1024, height: 768 },
  { name: '1280×800', width: 1280, height: 800 },
  { name: '1440×900', width: 1440, height: 900 },
  { name: '1920×1080', width: 1920, height: 1080 },
]

for (const viewport of viewports) {
  test(`Cash Flow stays contained at ${viewport.name}`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize(viewport)
    await page.goto('/cashflow')
    await expect(page.getByRole('heading', { name: 'Monthly overview' })).toBeVisible()
    await expect(page.locator('.financial-amount').filter({ hasText: '₫25,521,658' })).toBeVisible()
    await expectViewportContained(page)
  })
}

test('mobile navigation, Insights drawer, and More menu remain reachable', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/cashflow')

  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog', { name: 'Application navigation' })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Insights' }).click()
  await expect(page.getByRole('dialog', { name: 'Cash flow insights' })).toBeVisible()
  await page.getByRole('button', { name: 'Close Cash flow insights' }).click()

  await page.getByRole('button', { name: 'More' }).click()
  const menu = page.getByRole('menu', { name: 'Cash Flow actions' })
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expectViewportContained(page)
})

test('Cash Flow supports dark theme without horizontal overflow', async ({ page }) => {
  await mockApi(page)
  await page.addInitScript(() => localStorage.setItem('apexvoid-ledger:theme', 'dark'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cashflow')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expectViewportContained(page)
})
