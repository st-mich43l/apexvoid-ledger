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
    if (['/api/monthly-routine', '/api/monthly-budget', '/api/monthly-close', '/api/cashflow/trend', '/api/saving-pot'].includes(path)) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Fixture unavailable' }) })
      return
    }
    const body = path === '/api/auth/me'
      ? user
      : path === '/api/net-worth/summary'
        ? { reportingCurrency: 'VND', totalAssets: 100000000, totalLiabilities: 50000000, netWorth: 50000000, conversionComplete: true, valuationComplete: true, assetBreakdown: [], liabilityBreakdown: [], warnings: [], lastUpdatedAt: null }
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

for (const width of [320, 768, 1440]) {
  test(`account icon and chevron remain aligned at ${width}px`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard')
    const trigger = page.getByRole('button', { name: 'Account menu for responsive' })
    const avatar = trigger.locator('[aria-hidden="true"]').first()
    const chevron = trigger.locator('svg')
    const avatarBox = await avatar.boundingBox()
    const chevronBox = await chevron.boundingBox()
    expect(avatarBox).not.toBeNull()
    expect(chevronBox).not.toBeNull()
    expect(Math.abs((avatarBox!.y + avatarBox!.height / 2) - (chevronBox!.y + chevronBox!.height / 2))).toBeLessThan(2)
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('menu', { name: 'Account menu' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expectViewportContained(page)
  })
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

  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog', { name: 'Application navigation' })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Insights' }).click()
  await expect(page.getByRole('dialog', { name: 'Cash flow insights' })).toBeVisible()
  await page.getByRole('button', { name: 'Close Cash flow insights' }).click()

  await page.getByRole('button', { name: 'More', exact: true }).click()
  const menu = page.getByRole('dialog', { name: 'Cash Flow actions' })
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await page.getByText('Search & filters').click()
  await expect(page.getByRole('textbox', { name: 'Search activity' })).toBeVisible()
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

test('mobile dashboard presents financial position and accessible navigation', async ({ page }, testInfo) => {
  await mockApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  const position = page.getByRole('region', { name: 'Financial position' })
  await expect(position.getByText('Verified bank assets')).toBeVisible()
  await expect(position.getByText('₫100,000,000')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  await expectViewportContained(page)
  await page.screenshot({ path: testInfo.outputPath('mobile-dashboard.png'), fullPage: true })
})

test('desktop dashboard retains primary navigation', async ({ page }, testInfo) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden()
  await expectViewportContained(page)
  await page.screenshot({ path: testInfo.outputPath('desktop-dashboard.png'), fullPage: true })
})

for (const width of [320, 1440]) {
  test(`Home dashboard balance privacy and navigation work at ${width}px`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/home')
    const dashboard = page.locator('main').getByRole('link', { name: /Dashboard/ })
    const eye = page.getByRole('button', { name: 'Hide monetary amounts (Dashboard)', exact: true })
    await expect(dashboard.locator('.financial-amount')).toHaveText('₫50,000,000')
    await expect(dashboard.getByRole('button')).toHaveCount(0)
    await eye.click()
    await expect(eye).toHaveAttribute('aria-pressed', 'true')
    await expect(dashboard.locator('.financial-amount')).toHaveText('••••')
    await expect(page).toHaveURL(/\/home$/)
    await eye.click()
    await expect(dashboard.locator('.financial-amount')).toHaveText('₫50,000,000')
    await page.getByRole('button', { name: 'Hide monetary amounts', exact: true }).click()
    await expect(dashboard.locator('.financial-amount')).toHaveText('••••')
    await eye.click()
    await expect(dashboard.locator('.financial-amount')).toHaveText('₫50,000,000')
    await dashboard.click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expectViewportContained(page)
  })
}

test('desktop navigation dropdown items are compact, left-aligned, and keyboard dismissible', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  for (const group of ['Planning', 'Wealth']) {
    const trigger = page.getByRole('button', { name: group })
    await trigger.click()
    const menu = page.getByRole('menu', { name: `${group} navigation` })
    await expect(menu).toBeVisible()
    const entries = menu.getByRole('menuitem')
    for (const entry of await entries.all()) {
      await expect(entry).toHaveCSS('justify-content', 'space-between')
      const itemBox = await entry.boundingBox()
      const labelBox = await entry.locator('span').first().boundingBox()
      expect(labelBox!.x - itemBox!.x).toBeLessThanOrEqual(16)
      expect(itemBox!.height).toBeGreaterThanOrEqual(40)
    }
    expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(200)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  }
})

test('installable app registers a service worker without requesting notification permission', async ({ page }) => {
  await mockApi(page)
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'requestPermission', { value: () => { throw new Error('Unexpected permission prompt') } })
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/dashboard')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.ready
    return { scope: worker.scope, script: worker.active?.scriptURL }
  })
  expect(new URL(registration.scope).pathname).toBe('/')
  expect(new URL(registration.script!).pathname).toBe('/service-worker.js')
  expect(errors).toEqual([])
})

for (const theme of ['light', 'dark'] as const) {
  test(`floating navigation stays usable in ${theme} theme`, async ({ page }, testInfo) => {
    await mockApi(page)
    await page.addInitScript((value) => localStorage.setItem('apexvoid-ledger:theme', value), theme)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/cashflow')
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(nav.getByRole('link', { name: 'Cash Flow' })).toHaveAttribute('aria-current', 'page')
    const initial = await nav.boundingBox()
    expect(initial).not.toBeNull()
    expect(initial!.x).toBeGreaterThan(0)
    expect(initial!.x + initial!.width).toBeLessThan(390)
    const background = await nav.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(background).toContain(theme === 'dark' ? '41, 38, 49' : '249, 248, 251')
    await page.screenshot({ path: testInfo.outputPath(`matte-navigation-${theme}.png`) })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(nav).toBeVisible()
    const scrolled = await nav.boundingBox()
    expect(Math.abs(scrolled!.y - initial!.y)).toBeLessThan(1)
    await expectViewportContained(page)
    await nav.getByRole('button', { name: 'Open navigation' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Application navigation' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Application navigation' })).toBeHidden()
    await expect(nav.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  })
}

for (const route of ['/home', '/dashboard', '/cashflow', '/net-worth', '/saving-pot', '/loan', '/budget', '/monthly-routine', '/monthly-close', '/settings/users']) {
  test(`mobile route ${route} renders without page overflow`, async ({ page }, testInfo) => {
    await mockApi(page)
    await page.setViewportSize({ width: 390, height: 844 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(route)
    await expect(page.locator('main').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectViewportContained(page)
    expect(errors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`${route.slice(1).replaceAll('/', '-')}.png`), fullPage: true })
  })
}
