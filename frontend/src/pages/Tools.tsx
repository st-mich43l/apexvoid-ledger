import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import { formatCompactCurrency, formatCurrency } from '../lib/currency'
import { formatAmountDisplay, sanitizeAmountInput } from '../hooks/useLoanFormState'
import {
  COMPOUNDING_OPTIONS,
  compoundGrowthSeries,
  compoundInterest,
  compoundingPeriods,
  loanAmortizationSeries,
  loanFromRate,
  type CompoundingId,
  type CompoundGrowthPoint,
  type LoanAmortizationPoint,
  type LoanCalculatorType,
} from '../lib/financeTools'

const PRINCIPAL_COLOR = '#8b5cf6'
const INTEREST_COLOR = '#d97706'
const DEPOSIT_COLOR = '#10b981'

const inputClass =
  'min-w-0 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400'

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function handleAmountChange(onChange: (value: string) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    onChange(sanitizeAmountInput(event.target.value))
  }
}

export function FinanceCalculators() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <CompoundInterestCard />
      <InterestRateCard />
    </div>
  )
}

function CompoundInterestCard() {
  const { currency } = useCurrency()
  const formId = useId()
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('')
  const [years, setYears] = useState('1')
  const [frequency, setFrequency] = useState<CompoundingId>('monthly')
  const [contribution, setContribution] = useState('')

  const result = useMemo(() => {
    const parsedPrincipal = parseNumber(principal)
    const parsedRate = parseNumber(rate)
    const parsedYears = parseNumber(years)
    const parsedContribution = parseNumber(contribution) ?? 0
    if (parsedPrincipal === null || parsedRate === null || parsedYears === null) return null
    return compoundInterest({
      principal: parsedPrincipal,
      annualRatePercent: parsedRate,
      years: parsedYears,
      compoundsPerYear: compoundingPeriods(frequency),
      contributionPerPeriod: parsedContribution,
    })
  }, [principal, rate, years, frequency, contribution])

  const growth = useMemo(() => {
    const parsedPrincipal = parseNumber(principal)
    const parsedRate = parseNumber(rate)
    const parsedYears = parseNumber(years)
    const parsedContribution = parseNumber(contribution) ?? 0
    if (parsedPrincipal === null || parsedRate === null || parsedYears === null) return null
    return compoundGrowthSeries({
      principal: parsedPrincipal,
      annualRatePercent: parsedRate,
      years: parsedYears,
      compoundsPerYear: compoundingPeriods(frequency),
      contributionPerPeriod: parsedContribution,
    })
  }, [principal, rate, years, frequency, contribution])

  return (
    <article className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Compound interest</h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Grow a starting amount at a stated annual rate. Optional deposits are added at the end of each compounding period. Results split total deposit, profit estimate, and result estimate.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Starting amount" htmlFor={`${formId}-principal`}>
          <input id={`${formId}-principal`} inputMode="decimal" value={formatAmountDisplay(principal)} onChange={handleAmountChange(setPrincipal)} placeholder="10,000" className={inputClass} />
        </Field>
        <Field label="Annual rate" htmlFor={`${formId}-rate`}>
          <div className="relative">
            <input id={`${formId}-rate`} inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="6.5" className={`${inputClass} pr-8`} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-400">%</span>
          </div>
        </Field>
        <Field label="Years" htmlFor={`${formId}-years`}>
          <input id={`${formId}-years`} inputMode="decimal" value={years} onChange={(event) => setYears(event.target.value)} placeholder="10" className={inputClass} />
        </Field>
        <Field label="Compounds" htmlFor={`${formId}-frequency`}>
          <select id={`${formId}-frequency`} value={frequency} onChange={(event) => setFrequency(event.target.value as CompoundingId)} className={inputClass}>
            {COMPOUNDING_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Deposit each period (optional)" htmlFor={`${formId}-contribution`}>
          <input id={`${formId}-contribution`} inputMode="decimal" value={formatAmountDisplay(contribution)} onChange={handleAmountChange(setContribution)} placeholder="0" className={inputClass} />
        </Field>
      </div>

      {result ? (
        <>
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultStat
              label="Total deposit"
              value={formatCurrency(result.totalDeposit, currency)}
              accent={DEPOSIT_COLOR}
              hint={shareLabel(result.totalDeposit, result.futureValue)}
            />
            <ResultStat
              label="Profit estimate"
              value={formatCurrency(result.interestEarned, currency)}
              accent={INTEREST_COLOR}
              hint={shareLabel(result.interestEarned, result.futureValue)}
            />
            <ResultStat
              label="Result estimate"
              value={formatCurrency(result.futureValue, currency)}
              accent={PRINCIPAL_COLOR}
              hint="Deposit + profit"
            />
          </dl>
          {growth && growth.length > 1 && <GrowthChart points={growth} currency={currency} />}
        </>
      ) : (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">Enter a starting amount, annual rate, and years to see the result.</p>
      )}
    </article>
  )
}

function InterestRateCard() {
  const { currency } = useCurrency()
  const formId = useId()
  const [loanType, setLoanType] = useState<LoanCalculatorType>('unsecured')
  const [disbursement, setDisbursement] = useState('')
  const [rate, setRate] = useState('')
  const [term, setTerm] = useState('12')

  const result = useMemo(() => {
    const parsedDisbursement = parseNumber(disbursement)
    const parsedRate = parseNumber(rate)
    const parsedTerm = parseNumber(term)
    if (parsedDisbursement === null || parsedRate === null || parsedTerm === null) return null
    if (!Number.isInteger(parsedTerm)) return null
    return loanFromRate({
      disbursementAmount: parsedDisbursement,
      annualRatePercent: parsedRate,
      durationMonths: parsedTerm,
      loanType,
      currency,
    })
  }, [disbursement, rate, term, loanType, currency])

  const schedule = useMemo(() => {
    if (result === null) return null
    const parsedDisbursement = parseNumber(disbursement)
    const parsedTerm = parseNumber(term)
    if (parsedDisbursement === null || parsedTerm === null || !Number.isInteger(parsedTerm)) return null
    return loanAmortizationSeries(
      parsedDisbursement,
      result.monthlyPayment,
      parsedTerm,
      loanType,
      result.annualRatePercent,
    )
  }, [disbursement, term, loanType, result])

  return (
    <article className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Loan interest rate</h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Enter disbursement, annual rate, and term. Monthly payment is calculated the same way Ledger builds a loan — declining-balance EMI for unsecured, interest-only for secured.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Disbursement amount" htmlFor={`${formId}-disbursement`}>
          <input id={`${formId}-disbursement`} inputMode="decimal" value={formatAmountDisplay(disbursement)} onChange={handleAmountChange(setDisbursement)} placeholder="120,000,000" className={inputClass} />
        </Field>
        <Field label="Annual rate" htmlFor={`${formId}-rate`}>
          <div className="relative">
            <input id={`${formId}-rate`} inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="12" className={`${inputClass} pr-8`} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-400">%</span>
          </div>
        </Field>
        <Field label="Term" htmlFor={`${formId}-term`}>
          <div className="relative">
            <input id={`${formId}-term`} inputMode="numeric" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="12" className={`${inputClass} pr-20`} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-neutral-400">months</span>
          </div>
        </Field>
        <Field label="Loan type" htmlFor={`${formId}-type`}>
          <select id={`${formId}-type`} value={loanType} onChange={(event) => setLoanType(event.target.value as LoanCalculatorType)} className={inputClass}>
            <option value="unsecured">Unsecured</option>
            <option value="secured">Secured</option>
          </select>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {loanType === 'unsecured' ? 'Declining-balance EMI' : 'Fixed balance · interest-only'}
          </p>
        </Field>
      </div>

      {result ? (
        <>
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultStat label="Monthly payment" value={formatCurrency(result.monthlyPayment, currency)} accent={PRINCIPAL_COLOR} />
            <ResultStat
              label={loanType === 'secured' ? 'Interest over term' : 'Total interest'}
              value={formatCurrency(result.totalInterest, currency)}
              accent={INTEREST_COLOR}
            />
            <ResultStat
              label={loanType === 'secured' ? 'Principal remaining' : 'Total repayment'}
              value={formatCurrency(loanType === 'secured' ? result.remainingPrincipal : result.totalRepayment, currency)}
            />
          </dl>
          <CompositionBar
            label={loanType === 'secured' ? 'Interest paid vs remaining principal' : 'What each repayment is made of'}
            segments={
              loanType === 'secured'
                ? [
                  { label: 'Remaining principal', amount: result.remainingPrincipal, color: PRINCIPAL_COLOR },
                  { label: 'Interest', amount: result.totalInterest, color: INTEREST_COLOR },
                ]
                : [
                  { label: 'Principal', amount: Math.max(0, result.totalRepayment - result.totalInterest), color: PRINCIPAL_COLOR },
                  { label: 'Interest', amount: Math.max(0, result.totalInterest), color: INTEREST_COLOR },
                ]
            }
            currency={currency}
          />
          {schedule && schedule.length > 0 && <AmortizationChart points={schedule} currency={currency} />}
        </>
      ) : (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Enter disbursement, annual rate, and term to calculate the monthly payment.
        </p>
      )}
    </article>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{label}</label>
      {children}
    </div>
  )
}

function shareLabel(part: number, total: number): string {
  if (!(total > 0)) return '0% of result'
  const percent = (part / total) * 100
  const digits = percent >= 9.95 || percent === 0 ? 0 : 1
  return `${percent.toFixed(digits)}% of result`
}

function ResultStat({
  label,
  value,
  accent,
  hint,
}: {
  label: string
  value: string
  accent?: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
        {accent ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} /> : null}
        {label}
      </dt>
      <dd className="mt-1 break-all text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{hint}</p> : null}
    </div>
  )
}

function CompositionBar({
  label,
  segments,
  currency,
}: {
  label: string
  segments: { label: string; amount: number; color: string }[]
  currency: string
}) {
  const visible = segments.filter((segment) => segment.amount > 0)
  const total = visible.reduce((sum, segment) => sum + segment.amount, 0)
  if (total <= 0) return null

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" role="img" aria-label={label}>
        {visible.map((segment) => (
          <div
            key={segment.label}
            className="h-full"
            style={{ width: `${(segment.amount / total) * 100}%`, backgroundColor: segment.color }}
            title={`${segment.label}: ${formatCurrency(segment.amount, currency)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
        {visible.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: segment.color }} />
            {segment.label} {formatCurrency(segment.amount, currency)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function linePath(
  points: CompoundGrowthPoint[],
  xFor: (index: number) => number,
  yFor: (value: number) => number,
  valueOf: (point: CompoundGrowthPoint) => number,
): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(valueOf(point))}`).join(' ')
}

function stackedAreaPath(
  points: CompoundGrowthPoint[],
  xFor: (index: number) => number,
  yFor: (value: number) => number,
  lowerOf: (point: CompoundGrowthPoint) => number,
  upperOf: (point: CompoundGrowthPoint) => number,
): string {
  const top = linePath(points, xFor, yFor, upperOf)
  const bottom = points
    .map((_, index) => points.length - 1 - index)
    .map((index) => `L ${xFor(index)} ${yFor(lowerOf(points[index]))}`)
    .join(' ')
  return `${top} ${bottom} Z`
}

function yearTickLabel(year: number): string {
  if (year === 0) return 'Start'
  return Number.isInteger(year) ? `Y${year}` : `Y${year.toFixed(1)}`
}

function pickTickIndices(count: number): number[] {
  const maxTicks = 6
  if (count <= maxTicks) return Array.from({ length: count }, (_, index) => index)
  const step = Math.ceil((count - 1) / (maxTicks - 1))
  const indices: number[] = []
  for (let index = 0; index < count - 1; index += step) indices.push(index)
  indices.push(count - 1)
  return indices
}

function GrowthChart({ points, currency }: { points: CompoundGrowthPoint[]; currency: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const width = 640
  const height = 248
  const pad = { top: 16, right: 16, bottom: 32, left: 52 }
  const maxValue = Math.max(...points.map((point) => point.resultEstimate), 1)
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const xFor = (index: number) => pad.left + (index / Math.max(points.length - 1, 1)) * plotWidth
  const yFor = (value: number) => pad.top + plotHeight - (value / maxValue) * plotHeight
  const activeIndex = hoverIndex ?? points.length - 1
  const active = points[activeIndex]
  const depositArea = stackedAreaPath(points, xFor, yFor, () => 0, (point) => point.totalDeposit)
  const profitArea = stackedAreaPath(points, xFor, yFor, (point) => point.totalDeposit, (point) => point.resultEstimate)
  const resultLine = linePath(points, xFor, yFor, (point) => point.resultEstimate)

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativeX = ((event.clientX - rect.left) / rect.width) * width
    const fraction = (relativeX - pad.left) / plotWidth
    const index = Math.round(fraction * (points.length - 1))
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)))
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">Growth over time</p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DEPOSIT_COLOR }} />
            Total deposit
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INTEREST_COLOR }} />
            Profit estimate
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRINCIPAL_COLOR }} />
            Result estimate
          </li>
        </ul>
      </div>

      <div className="relative mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-52 w-full touch-none"
          role="img"
          aria-label="Stacked growth of total deposit and profit estimate. The top edge is the result estimate."
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {[0, 0.5, 1].map((fraction) => {
            const y = pad.top + plotHeight * (1 - fraction)
            return (
              <g key={fraction}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  className="stroke-neutral-100 dark:stroke-neutral-800"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-neutral-400 text-[9px] dark:fill-neutral-500"
                >
                  {formatCompactCurrency(maxValue * fraction, currency)}
                </text>
              </g>
            )
          })}

          <path d={depositArea} fill={DEPOSIT_COLOR} fillOpacity={0.22} stroke="none" />
          <path d={profitArea} fill={INTEREST_COLOR} fillOpacity={0.28} stroke="none" />
          <path
            d={linePath(points, xFor, yFor, (point) => point.totalDeposit)}
            fill="none"
            stroke={DEPOSIT_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={resultLine}
            fill="none"
            stroke={PRINCIPAL_COLOR}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <line
            x1={xFor(activeIndex)}
            x2={xFor(activeIndex)}
            y1={pad.top}
            y2={pad.top + plotHeight}
            className="stroke-neutral-300 dark:stroke-neutral-600"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <circle cx={xFor(activeIndex)} cy={yFor(active.totalDeposit)} r={4} fill={DEPOSIT_COLOR} stroke="white" strokeWidth={1.5} className="dark:stroke-neutral-900" />
          <circle cx={xFor(activeIndex)} cy={yFor(active.resultEstimate)} r={4.5} fill={PRINCIPAL_COLOR} stroke="white" strokeWidth={1.5} className="dark:stroke-neutral-900" />

          {pickTickIndices(points.length).map((index) => (
            <text
              key={points[index].year}
              x={xFor(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-neutral-400 text-[9px] dark:fill-neutral-500"
            >
              {yearTickLabel(points[index].year)}
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs sm:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="font-semibold text-neutral-900 dark:text-neutral-50">
          {active.year === 0 ? 'Start' : `Year ${Number.isInteger(active.year) ? active.year : active.year.toFixed(1)}`}
        </p>
        <p style={{ color: DEPOSIT_COLOR }}>
          Deposit {formatCurrency(active.totalDeposit, currency)}
        </p>
        <p style={{ color: INTEREST_COLOR }}>
          Profit {formatCurrency(active.profitEstimate, currency)}
        </p>
        <p className="font-semibold" style={{ color: PRINCIPAL_COLOR }}>
          Result {formatCurrency(active.resultEstimate, currency)}
        </p>
      </div>
    </div>
  )
}

function AmortizationChart({ points, currency }: { points: LoanAmortizationPoint[]; currency: string }) {
  const maxBars = 60
  const stride = Math.max(1, Math.ceil(points.length / maxBars))
  const sampled = points.filter((_, index) => index % stride === 0 || index === points.length - 1)
  const barWidth = 6
  const gap = 3
  const height = 140
  const padTop = 8
  const padBottom = 8
  const plotHeight = height - padTop - padBottom
  const width = Math.max(sampled.length * (barWidth + gap), 120)
  const maxPayment = Math.max(...sampled.map((point) => point.principal + point.interest), 1)

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">Principal vs interest by term</p>
        <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-300">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRINCIPAL_COLOR }} />Principal</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INTEREST_COLOR }} />Interest</span>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="max-w-none" role="img" aria-label="Principal and interest per installment">
          {sampled.map((point, index) => {
            const x = index * (barWidth + gap)
            const principalHeight = (point.principal / maxPayment) * plotHeight
            const interestHeight = (point.interest / maxPayment) * plotHeight
            const base = padTop + plotHeight
            return (
              <g key={point.term}>
                <rect x={x} y={base - principalHeight} width={barWidth} height={principalHeight} fill={PRINCIPAL_COLOR} />
                <rect x={x} y={base - principalHeight - interestHeight} width={barWidth} height={interestHeight} fill={INTEREST_COLOR} />
                <title>
                  {`Term ${point.term}\nPrincipal ${formatCurrency(point.principal, currency)}\nInterest ${formatCurrency(point.interest, currency)}`}
                </title>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
