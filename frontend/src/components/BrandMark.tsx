// The "Rising Balance" mark: the trending-up line every finance view already
// draws, ending in an open ring instead of a filled dot — the void is where
// the next entry hasn't landed yet.
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={`text-violet-600 dark:text-violet-400 ${className}`}
    >
      <path
        d="M12,76 L30,64 L44,70 L62,32"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="71" cy="24" r="10" stroke="currentColor" strokeWidth="7" />
      <line x1="10" y1="86" x2="90" y2="86" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

interface BrandLockupProps {
  className?: string
  markClassName?: string
}

export function BrandLockup({ className = '', markClassName = 'h-9 w-9' }: BrandLockupProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark className={markClassName} />
      <span className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        apexvoid
      </span>
    </div>
  )
}
