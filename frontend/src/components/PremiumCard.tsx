import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Accent = 'violet' | 'cyan' | 'emerald' | 'amber'

const accentStyles: Record<Accent, { badge: string; ring: string; glow: string }> = {
  violet: {
    badge: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    ring: 'hover:ring-violet-500/30 dark:hover:ring-violet-400/30',
    glow: 'from-violet-500/10',
  },
  cyan: {
    badge: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
    ring: 'hover:ring-cyan-500/30 dark:hover:ring-cyan-400/30',
    glow: 'from-cyan-500/10',
  },
  emerald: {
    badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    ring: 'hover:ring-emerald-500/30 dark:hover:ring-emerald-400/30',
    glow: 'from-emerald-500/10',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    ring: 'hover:ring-amber-500/30 dark:hover:ring-amber-400/30',
    glow: 'from-amber-500/10',
  },
}

interface PremiumCardProps {
  title: string
  icon: ReactNode
  accent: Accent
  value: string
  subtitle: string
  to?: string
  comingSoon?: boolean
}

export function PremiumCard({ title, icon, accent, value, subtitle, to, comingSoon }: PremiumCardProps) {
  const styles = accentStyles[accent]

  const card = (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_2px_8px_-2px_rgba(24,16,54,0.08),0_16px_32px_-12px_rgba(24,16,54,0.10)] ring-1 ring-transparent transition-all duration-300 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none ${
        comingSoon ? 'opacity-80' : `hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_rgba(24,16,54,0.10),0_24px_40px_-12px_rgba(24,16,54,0.14)] ${styles.ring}`
      }`}
    >
      <div
        className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br ${styles.glow} to-transparent blur-2xl`}
      />

      <div className="relative flex items-start justify-between">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${styles.badge}`}>{icon}</div>

        {comingSoon ? (
          <span className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase dark:border-neutral-700 dark:text-neutral-500">
            Coming soon
          </span>
        ) : (
          to && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-4 w-4 -translate-x-1 text-neutral-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 dark:text-neutral-600"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )
        )}
      </div>

      <p className="relative mt-5 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        {title}
      </p>
      <p className="relative mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50">
        {value}
      </p>
      <p className="relative mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
    </div>
  )

  if (to && !comingSoon) {
    return (
      <Link to={to} className="block">
        {card}
      </Link>
    )
  }

  return card
}
