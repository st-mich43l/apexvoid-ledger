export const loadDashboard = () => import('../pages/Dashboard').then((module) => ({ default: module.Dashboard }))
export const loadCashFlow = () => import('../pages/CashFlow').then((module) => ({ default: module.CashFlowPage }))
export const loadNetWorth = () => import('../pages/NetWorth').then((module) => ({ default: module.NetWorthPage }))

const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': loadDashboard,
  '/cashflow': loadCashFlow,
  '/net-worth': loadNetWorth,
}

export function canPreloadRoute() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !connection?.saveData && (!connection?.effectiveType || connection.effectiveType === '4g')
}

export function preloadRoute(path: string) {
  if (!canPreloadRoute()) return
  const route = path.split('?')[0]
  const preload = routePreloaders[route]
  if (preload) void preload().catch(() => {})
}
