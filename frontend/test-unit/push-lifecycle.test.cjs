const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/lib/push.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function browserPush({ userId = 'alice', deleteStatus = null } = {}) {
  const storage = new Map([['apexvoid-ledger:push-device', JSON.stringify({ userId, id: 'device-1' })]])
  let unsubscribed = 0
  let deleted = 0
  class ApiError extends Error { constructor(status) { super('API error'); this.status = status } }
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    require: () => ({
      ApiError,
      deletePushDevice: async () => { deleted++; if (deleteStatus) throw new ApiError(deleteStatus) },
    }),
    navigator: {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: { getSubscription: async () => ({ unsubscribe: async () => { unsubscribed++ } }) },
        }),
      },
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  }
  vm.runInNewContext(compiled, sandbox, { filename: 'push.ts' })
  return { push: module.exports, storage, counters: () => ({ unsubscribed, deleted }) }
}

test('session expiry discards the local subscription even without authenticated API access', async () => {
  const browser = browserPush()
  await browser.push.reconcileLocalPushForUser(null)
  assert.equal(browser.storage.size, 0)
  assert.deepEqual(browser.counters(), { unsubscribed: 1, deleted: 0 })
})

test('the same account keeps its existing browser subscription', async () => {
  const browser = browserPush()
  await browser.push.reconcileLocalPushForUser('alice')
  assert.equal(browser.storage.size, 1)
  assert.deepEqual(browser.counters(), { unsubscribed: 0, deleted: 0 })
})

test('account switching removes the previous account subscription', async () => {
  const browser = browserPush()
  await browser.push.reconcileLocalPushForUser('bob')
  assert.equal(browser.storage.size, 0)
  assert.deepEqual(browser.counters(), { unsubscribed: 1, deleted: 0 })
})

test('sign-out removes the browser subscription even when server session expired', async () => {
  const browser = browserPush({ deleteStatus: 401 })
  await browser.push.releaseCurrentPush('alice')
  assert.equal(browser.storage.size, 0)
  assert.deepEqual(browser.counters(), { unsubscribed: 1, deleted: 1 })
})
