import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { dateDigitsToIso, isValidDateDigits, isoDateToDigits } from '../lib/date'

interface DayMonthYearInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
}

type DatePart = 'day' | 'month' | 'year'

function dateParts(value: string): Record<DatePart, string> {
  if (value.includes('/')) {
    const [day = '', month = '', year = ''] = value.split('/')
    return { day, month, year }
  }

  const digits = value.replace(/\D/g, '')
  return {
    day: digits.slice(0, 2),
    month: digits.slice(2, 4),
    year: digits.slice(4, 8),
  }
}

export function DayMonthYearInput({
  id,
  value,
  onChange,
  disabled,
  required,
  className = '',
}: DayMonthYearInputProps) {
  const dayRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)
  const parts = dateParts(value)

  const updatePart = (part: DatePart, nextValue: string) => {
    const maxLength = part === 'year' ? 4 : 2
    const nextParts = { ...parts, [part]: nextValue.replace(/\D/g, '').slice(0, maxLength) }
    onChange(`${nextParts.day}/${nextParts.month}/${nextParts.year}`)

    if (nextParts[part].length === maxLength) {
      if (part === 'day') monthRef.current?.focus()
      if (part === 'month') yearRef.current?.focus()
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '')
    if (pastedDigits.length !== 8) return

    event.preventDefault()
    onChange(`${pastedDigits.slice(0, 2)}/${pastedDigits.slice(2, 4)}/${pastedDigits.slice(4, 8)}`)
    yearRef.current?.focus()
  }

  const focusPrevious = (
    event: KeyboardEvent<HTMLInputElement>,
    currentValue: string,
    previous: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (event.key === 'Backspace' && currentValue === '') previous.current?.focus()
  }

  const selectPickedDate = (isoDate: string) => {
    const digits = isoDateToDigits(isoDate)
    if (digits) onChange(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`)
  }

  return (
    <div className={`relative flex items-center gap-1.5 pr-12 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 dark:focus-within:border-violet-400 ${className}`}>
      <input
        ref={dayRef}
        id={id}
        value={parts.day}
        onChange={(event) => updatePart('day', event.target.value)}
        onPaste={handlePaste}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Day"
        placeholder="DD"
        maxLength={2}
        className={segmentClass}
      />
      <span aria-hidden="true" className={separatorClass}>/</span>
      <input
        ref={monthRef}
        value={parts.month}
        onChange={(event) => updatePart('month', event.target.value)}
        onPaste={handlePaste}
        onKeyDown={(event) => focusPrevious(event, parts.month, dayRef)}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Month"
        placeholder="MM"
        maxLength={2}
        className={segmentClass}
      />
      <span aria-hidden="true" className={separatorClass}>/</span>
      <input
        ref={yearRef}
        value={parts.year}
        onChange={(event) => updatePart('year', event.target.value)}
        onPaste={handlePaste}
        onKeyDown={(event) => focusPrevious(event, parts.year, monthRef)}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Year"
        placeholder="YYYY"
        maxLength={4}
        className={`${segmentClass} w-12`}
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute right-3 h-4 w-4 text-neutral-400 dark:text-neutral-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 9h16.5M5.25 4.5h13.5a1.5 1.5 0 0 1 1.5 1.5v13.5h-16.5V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
      <input
        type="date"
        value={isValidDateDigits(value) ? dateDigitsToIso(value) : ''}
        onChange={(event) => selectPickedDate(event.target.value)}
        disabled={disabled}
        aria-label="Choose date from calendar"
        className="absolute inset-y-0 right-0 w-11 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  )
}

const segmentClass =
  'min-w-0 w-7 bg-transparent p-0 text-center text-sm text-neutral-900 outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const separatorClass = 'text-sm text-neutral-400 dark:text-neutral-500'
