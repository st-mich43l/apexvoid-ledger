const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

function worker() {
  const handlers = {}
  const notifications = []
  const opened = []
  const self = {
    location: { origin: 'https://ledger.example' },
    addEventListener: (name, handler) => { handlers[name] = handler },
    registration: { showNotification: async (title, options) => { notifications.push({ title, options }) } },
    clients: { matchAll: async () => [], openWindow: async (url) => { opened.push(url) } },
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/service-worker.js'), 'utf8'), { self, URL })
  return { handlers, notifications, opened }
}

test('push displays a generic notification and preserves a safe local destination', async () => {
  const { handlers, notifications } = worker()
  let operation
  handlers.push({ data: { json: () => ({ destination: '/cashflow?month=1', body: 'private amount' }) }, waitUntil: (value) => { operation = value } })
  await operation
  assert.equal(notifications[0].title, 'ApexVoid Ledger')
  assert.equal(notifications[0].options.body, 'You have a new notification in Ledger.')
  assert.equal(notifications[0].options.data.destination, '/cashflow?month=1')
})

test('notification click rejects external destinations and closes the notification', async () => {
  const { handlers, opened } = worker()
  let operation
  let closed = false
  handlers.notificationclick({ notification: { data: { destination: '//evil.example/' }, close: () => { closed = true } }, waitUntil: (value) => { operation = value } })
  await operation
  assert.equal(closed, true)
  assert.equal(opened[0], 'https://ledger.example/dashboard')
})

test('malformed push payload still produces a visible notification', async () => {
  const { handlers, notifications } = worker()
  let operation
  handlers.push({ data: { json: () => { throw new Error('invalid') } }, waitUntil: (value) => { operation = value } })
  await operation
  assert.equal(notifications[0].options.data.destination, '/dashboard')
})
