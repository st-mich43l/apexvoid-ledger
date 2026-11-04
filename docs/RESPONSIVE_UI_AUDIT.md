# Responsive UI audit

Date: 2026-11-04

## Root causes

| Severity | Finding | Affected areas | Resolution |
| --- | --- | --- | --- |
| High | Popover menus were positioned in their local stacking context or aligned only from the right edge. At narrow widths, this allowed menus to leave the visual viewport. | Cash Flow actions; currency picker in the mobile drawer | Menus now use a viewport-aware fixed position, recalculate for resize and scroll, and flip above the trigger when there is no room below. |
| High | The Cash Flow action row assumed its three desktop controls would fit on one row. | `/cashflow` at 320–375px | The action group becomes a deliberate two-column mobile layout with a full-width primary action; the month selector becomes fluid. |
| High | Dialogs used desktop-centred geometry at every viewport and did not provide a universal visible close target. | All dialogs and the Insights drawer | The shared modal is a mobile bottom sheet, has dynamic-viewport height limits, safe-area padding, focus trapping, scroll locking, Escape/backdrop dismissal, and a 44px close control. |
| Medium | Header icon targets were 32–36px on touch layouts. | App header, theme, account, and navigation controls | Mobile header controls now use 40–44px targets while retaining compact desktop sizing. |
| Medium | Shared page and flex children did not consistently declare intrinsic shrinkability. | Shell, toolbars, cards, tables, charts | The responsive foundation now provides fluid page gutters, min-width-safe shell rules, controlled table scrolling, and media sizing guards. |
| Medium | Dense desktop tables need an explicit contained-overflow policy rather than relying on page overflow. | Loans, user accounts, schedules, activity tables | Existing mobile-card views are retained; genuinely dense desktop tables use local horizontal scrolling only. |

## Route coverage

The audit covered the application shell and all routes registered in `frontend/src/App.tsx`: Login, Home, Dashboard, Cash Flow, Budget, Monthly Close, Monthly Routine, Net Worth, Saving Pot, Loans, Loan Detail, Currency Selection, User Accounts, and the calculator content rendered from Home.

Key responsive patterns already present and preserved:

- Mobile cards for Cash Flow activity and loan schedules.
- Intrinsic grid breakpoints (`sm`, `lg`, `xl`) for dashboards, planning, reports, and connected accounts.
- Local scroll containers for wide charts and data tables.
- Breakable/tabular financial values through `.financial-amount`.
- A desktop-only independent Cash Flow Insights rail; a drawer entry point remains available below the wide-desktop breakpoint.

## Shared implementation rules

- Do not add page-level `overflow: hidden` to hide layout faults.
- Add `min-w-0` to flex/grid children that contain long values or controls.
- Use `minmax(0, ...)` for constrained grid tracks.
- Keep wide data inside `.responsive-table`; do not allow it to widen the application viewport.
- Use the shared `Modal` for dialogs and sheets. It owns focus, Escape, backdrop, scroll lock, dynamic-height, safe-area, and close-control behavior.
- Viewport-bound popovers must be portalled and positioned from the trigger with an 8px viewport gutter.

## Validation scope

The project currently has no browser/component test runner configured. The responsive work is validated through TypeScript, lint, production build, static layout review, and the documented viewport matrix should be run in a browser or CI once Playwright is introduced. No finance calculations, API contracts, authentication permissions, or SePay behavior are changed by this work.
