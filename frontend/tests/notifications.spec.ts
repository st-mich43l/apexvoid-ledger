import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path === '/api/auth/me') body = { id: 'user-1', username: 'alice', isAdmin: false, mustChangePassword: false, preferredCurrency: 'VND', createdAt: '2026-01-01T00:00:00Z' }
    else if (path === '/api/notifications/unread-count') body = { count: 1 }
    else if (path === '/api/notifications') body = [{ id: 'notice-1', eventType: 'bank_activity', title: 'ApexVoid Ledger', body: 'New bank activity requires your review.', destination: '/cashflow', createdAt: '2026-11-04T00:00:00Z', readAt: null }]
    else if (path === '/api/notifications/notice-1/read') body = { id: 'notice-1', readAt: '2026-11-04T01:00:00Z' }
    else if (path === '/api/notifications/preferences') body = { bankActivity: true, budgetAlerts: true, paymentReminders: true, monthlySummary: false, timezone: 'UTC', quietStart: null, quietEnd: null }
    else if (path === '/api/push/config') body = { configured: false, publicKey: null }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
})

test('inbox remains usable and navigates after marking notification read', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/notifications')
  const read = page.waitForRequest(request => request.url().includes('/api/notifications/notice-1/read') && request.method() === 'PATCH')
  await page.getByRole('button', { name: /New bank activity requires your review/ }).click()
  await read
  await expect(page).toHaveURL(/\/cashflow$/)
})

test('settings explain unconfigured delivery without prompting for permission', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Notification, 'requestPermission', { value: () => { throw new Error('Unexpected permission prompt') } }) })
  await page.goto('/settings/notifications')
  await expect(page.getByText('Push delivery is not configured on the server.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable on this device' })).toBeDisabled()
  await expect(page.getByText('Bank activity', { exact: true })).toBeVisible()
})

test('an earlier account push device is discarded when another user signs in', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('apexvoid-ledger:push-device', JSON.stringify({ userId: 'previous-user', id: 'old-device' }))
  })
  await page.goto('/dashboard')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('apexvoid-ledger:push-device'))).toBeNull()
})
