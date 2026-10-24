import { useState, type FormEvent } from 'react'
import type { FinancialAccount, NetWorthLine, SePayConnectionInput, SePayWebhookAuthType } from '../types'
import { useNetWorth } from '../hooks/useNetWorth'
import { formatCurrency } from '../lib/currency'
import { useCurrency } from '../context/CurrencyContext'

export function NetWorthPage() {
  const { currency } = useCurrency()
  const { summary, accounts, loading, refreshing, connecting, error, refresh, connect, disconnect } = useNetWorth()
  const reportingCurrency = summary?.reportingCurrency ?? currency

  return (
    <section>
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
          Financial position
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Net Worth</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Verified assets minus outstanding loan balances, shown in {reportingCurrency}.
        </p>
      </div>

      {error && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      {summary?.warnings.length ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Valuation needs attention</p>
          <ul className="mt-1 space-y-1">
            {summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      <ConnectSePayCard connecting={connecting} onConnect={connect} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total assets"
          value={loading ? '…' : displayAmount(summary?.totalAssets ?? null, reportingCurrency)}
          accent="cyan"
        />
        <SummaryCard
          title="Total liabilities"
          value={loading ? '…' : displayAmount(summary?.totalLiabilities ?? null, reportingCurrency)}
          accent="rose"
        />
        <SummaryCard
          title="Net worth"
          value={loading ? '…' : displayAmount(summary?.netWorth ?? null, reportingCurrency)}
          accent="violet"
          prominent
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <section className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-600 dark:text-cyan-400">Bank assets</p>
              <h3 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Connected accounts</h3>
            </div>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{accounts.length} account{accounts.length === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <LoadingRow /> : accounts.length === 0 ? (
              <EmptyRow text="No bank account is associated with this Ledger user." />
            ) : accounts.map((account) => (
              <BankAccountCard
                key={account.id}
                account={account}
                refreshing={refreshing}
                onRefresh={() => void refresh(account.id)}
                onDisconnect={() => void disconnect(account.id)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400">Loan liabilities</p>
            <h3 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Outstanding balances</h3>
          </div>
          <div className="mt-5 space-y-3">
            {loading ? <LoadingRow /> : summary?.liabilityBreakdown.length ? (
              summary.liabilityBreakdown.map((line) => <BreakdownRow key={line.id} line={line} />)
            ) : <EmptyRow text="No loan liabilities recorded." />}
          </div>
        </section>
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 text-sm text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">Net Worth = Bank assets − Loan liabilities.</span>{' '}
        Saving Pots, cash-flow income/expenses, future income, and scheduled payments are not added separately.
        {!summary?.valuationComplete && <span className="ml-1 text-amber-700 dark:text-amber-300">The current valuation is incomplete.</span>}
      </div>
    </section>
  )
}

function SummaryCard({
  title,
  value,
  accent,
  prominent = false,
}: {
  title: string
  value: string
  accent: 'cyan' | 'rose' | 'violet'
  prominent?: boolean
}) {
  const color = {
    cyan: 'text-cyan-600 dark:text-cyan-400',
    rose: 'text-rose-600 dark:text-rose-400',
    violet: 'text-violet-600 dark:text-violet-400',
  }[accent]
  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">{title}</p>
      <p className={(prominent ? 'text-3xl ' : 'text-2xl ') + 'mt-2 truncate font-semibold tracking-tight tabular-nums ' + color}>
        {value}
      </p>
    </div>
  )
}

function BankAccountCard({
  account,
  refreshing,
  onRefresh,
  onDisconnect,
}: {
  account: FinancialAccount
  refreshing: boolean
  onRefresh: () => void
  onDisconnect: () => void
}) {
  const isUnavailable = account.balance === null
  const statusText = account.balanceStatus === 'verified'
    ? 'Verified balance'
    : account.balanceStatus === 'stale'
      ? 'Stale — last known balance'
      : account.balanceStatus === 'inactive'
        ? 'Account inactive'
        : 'Balance unavailable'
  const statusColor = account.balanceStatus === 'verified'
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-amber-700 dark:text-amber-300'
  const webhookAuthLabel = account.webhookAuthType === 'hmac_sha256'
    ? 'Webhook protected by HMAC-SHA256'
    : account.webhookAuthType === 'oauth2'
      ? 'Webhook protected by OAuth 2.0'
      : account.webhookAuthType === 'api_key'
        ? 'Webhook protected by API key'
        : account.webhookAuthType === 'none'
          ? 'Webhook authentication disabled — testing only'
          : null

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BankIcon />
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">{account.bankName}</p>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {account.accountNumberMasked} · {account.currency}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-wait disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-violet-700 dark:hover:text-violet-300"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={refreshing}
          className="rounded-full border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 disabled:cursor-wait disabled:opacity-50 dark:border-red-900/60 dark:text-red-300"
        >
          Disconnect
        </button>
      </div>
      <p className={'mt-5 text-2xl font-semibold tabular-nums ' + (isUnavailable ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-50')}>
        {isUnavailable ? 'Unavailable' : formatCurrency(account.balance ?? 0, account.currency)}
      </p>
      <p className={'mt-1 text-sm ' + statusColor}>{statusText}</p>
      {webhookAuthLabel && (
        <p className={'mt-1 text-xs ' + (account.webhookAuthType === 'none' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>{webhookAuthLabel}</p>
      )}
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {account.lastSyncedAt ? 'Last synchronized ' + formatDate(account.lastSyncedAt) : 'Not synchronized yet'}
      </p>
      {account.lastSyncError && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{account.lastSyncError}</p>
      )}
    </div>
  )
}

function ConnectSePayCard({
  connecting,
  onConnect,
}: {
  connecting: boolean
  onConnect: (input: SePayConnectionInput) => Promise<void>
}) {
  const [apiToken, setApiToken] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [webhookAuthType, setWebhookAuthType] = useState<SePayWebhookAuthType>('hmac_sha256')
  const [webhookAuthSecret, setWebhookAuthSecret] = useState('')
  const [webhookOauthClientId, setWebhookOauthClientId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const needsSecret = webhookAuthType !== 'none'
  const isOauth = webhookAuthType === 'oauth2'
  const oauthTokenUrl = window.location.origin + '/api/integrations/sepay/oauth/token'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    try {
      await onConnect({
        apiToken,
        accountNumber,
        webhookAuthType,
        webhookAuthSecret: needsSecret ? webhookAuthSecret : undefined,
        webhookOauthClientId: isOauth ? webhookOauthClientId : undefined,
      })
      setApiToken('')
      setAccountNumber('')
      setWebhookAuthSecret('')
      setWebhookOauthClientId('')
      setSubmitted(false)
    } catch {
      // The shared page error displays the safe server message.
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-[0_18px_45px_-35px_rgba(109,40,217,0.8)] dark:border-violet-900/70 dark:bg-neutral-900">
      <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50/60 px-5 py-4 dark:border-violet-900/50 dark:from-violet-950/50 dark:to-fuchsia-950/20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">Personal connection</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">Connect SePay</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Encrypted locally to your Ledger account</p>
        </div>
      </div>
      <form className="grid gap-4 p-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          SePay API token
          <input
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            autoComplete="off"
            required
            className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 font-normal text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
          />
        </label>
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Bank account number
          <input
            type="text"
            inputMode="numeric"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            autoComplete="off"
            required
            className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 font-normal text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
          />
        </label>
        </div>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Webhook authentication</legend>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Match this in SePay → Security</span>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <AuthMethodOption type="hmac_sha256" title="HMAC-SHA256" detail="Recommended" selected={webhookAuthType} onSelect={setWebhookAuthType} />
            <AuthMethodOption type="api_key" title="API key" detail="Simple header" selected={webhookAuthType} onSelect={setWebhookAuthType} />
            <AuthMethodOption type="oauth2" title="OAuth 2.0" detail="Client credentials" selected={webhookAuthType} onSelect={setWebhookAuthType} />
            <AuthMethodOption type="none" title="No authentication" detail="Testing only" selected={webhookAuthType} onSelect={setWebhookAuthType} warning />
          </div>
        </fieldset>

        {isOauth ? (
          <div className="grid gap-3 rounded-xl border border-violet-200/80 bg-violet-50/50 p-3 md:grid-cols-2 dark:border-violet-900/60 dark:bg-violet-950/20">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              OAuth client ID
              <input
                type="text"
                value={webhookOauthClientId}
                onChange={(event) => setWebhookOauthClientId(event.target.value)}
                autoComplete="off"
                required
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              OAuth client secret
              <input
                type="password"
                value={webhookAuthSecret}
                onChange={(event) => setWebhookAuthSecret(event.target.value)}
                autoComplete="off"
                required
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50"
              />
            </label>
            <p className="md:col-span-2 rounded-lg bg-white/80 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-950/70 dark:text-neutral-300">
              In SePay, set the OAuth token URL to <code className="font-mono text-violet-700 dark:text-violet-300">{oauthTokenUrl}</code>.
            </p>
          </div>
        ) : needsSecret ? (
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {webhookAuthType === 'hmac_sha256' ? 'HMAC secret key' : 'SePay webhook API key'}
            <input
              type="password"
              value={webhookAuthSecret}
              onChange={(event) => setWebhookAuthSecret(event.target.value)}
              autoComplete="off"
              required
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50"
            />
          </label>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">No authentication accepts unauthenticated requests. Use only with SePay test webhooks.</p>
        )}
        <button
          type="submit"
          disabled={connecting || !apiToken || !accountNumber || (needsSecret && !webhookAuthSecret) || (isOauth && !webhookOauthClientId)}
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-900/20 transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-50"
        >
          {connecting ? 'Connecting…' : submitted ? 'Try again' : 'Connect'}
        </button>
      </form>
    </section>
  )
}

function AuthMethodOption({
  type,
  title,
  detail,
  selected,
  onSelect,
  warning = false,
}: {
  type: SePayWebhookAuthType
  title: string
  detail: string
  selected: SePayWebhookAuthType
  onSelect: (type: SePayWebhookAuthType) => void
  warning?: boolean
}) {
  const active = selected === type
  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className={(active
        ? 'border-violet-500 bg-violet-50 text-violet-950 shadow-sm dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-50'
        : 'border-neutral-200 bg-white text-neutral-700 hover:border-violet-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-violet-800') + ' rounded-xl border px-3 py-2 text-left transition'}
    >
      <span className="flex items-center gap-2 text-sm font-semibold"><span className={(active ? 'bg-violet-600' : warning ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700') + ' h-1.5 w-1.5 rounded-full'} />{title}</span>
      <span className="mt-0.5 block text-[11px] font-normal text-neutral-500 dark:text-neutral-400">{detail}</span>
    </button>
  )
}

function BreakdownRow({ line }: { line: NetWorthLine }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 px-4 py-3 dark:border-neutral-800">
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{line.name}</p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{line.currency} · {line.status}</p>
      </div>
      <p className={'shrink-0 text-right font-semibold tabular-nums ' + (line.included ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-400 dark:text-neutral-500')}>
        {line.reportingAmount === null ? 'Incomplete' : formatCurrency(line.reportingAmount, line.reportingCurrency)}
      </p>
    </div>
  )
}

function displayAmount(value: number | null, currency: string) {
  return value === null ? 'Incomplete' : formatCurrency(value, currency)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function LoadingRow() {
  return <div className="rounded-2xl bg-neutral-100 px-4 py-5 text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">Loading…</div>
}

function EmptyRow({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{text}</div>
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5 text-cyan-600 dark:text-cyan-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10 12 4l9 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9M9 10v9M15 10v9M19 10v9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  )
}
