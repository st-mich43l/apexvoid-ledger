export type NavigationItem = {
  label: string
  to: string
  matches: (pathname: string) => boolean
}

export type NavigationGroup = {
  label: string
  matches: (pathname: string) => boolean
  items: NavigationItem[]
}

export const primaryNavigation: Array<NavigationItem | NavigationGroup> = [
  { label: 'Overview', to: '/dashboard', matches: (pathname) => pathname === '/dashboard' },
  { label: 'Cash Flow', to: '/cashflow', matches: (pathname) => pathname === '/cashflow' },
  {
    label: 'Planning',
    matches: (pathname) => ['/monthly-routine', '/budget', '/monthly-close'].some((route) => pathname === route),
    items: [
      { label: 'Monthly Routine', to: '/monthly-routine', matches: (pathname) => pathname === '/monthly-routine' },
      { label: 'Monthly Budget', to: '/budget', matches: (pathname) => pathname === '/budget' },
      { label: 'Monthly Close', to: '/monthly-close', matches: (pathname) => pathname === '/monthly-close' },
    ],
  },
  {
    label: 'Wealth',
    matches: (pathname) => ['/net-worth', '/saving-pot'].some((route) => pathname === route),
    items: [
      { label: 'Net Worth', to: '/net-worth', matches: (pathname) => pathname === '/net-worth' },
      { label: 'Saving Pot', to: '/saving-pot', matches: (pathname) => pathname === '/saving-pot' },
    ],
  },
  { label: 'Loans', to: '/loan', matches: (pathname) => pathname === '/loan' || pathname.startsWith('/loan/') },
]

export function isNavigationGroup(item: NavigationItem | NavigationGroup): item is NavigationGroup {
  return 'items' in item
}

export function navigationDestination(item: NavigationItem, group: NavigationGroup | null, search: string): string {
  if (group?.label !== 'Planning') return item.to
  const source = new URLSearchParams(search)
  const period = new URLSearchParams()
  for (const key of ['year', 'month']) {
    const value = source.get(key)
    if (value) period.set(key, value)
  }
  const query = period.toString()
  return query ? `${item.to}?${query}` : item.to
}
