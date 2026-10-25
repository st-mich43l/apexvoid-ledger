# ApexVoid Quiet Premium

UI Phase 1 establishes the shared visual foundation for the existing React
application. It improves presentation only: routes, API calls, Ledger rules,
SePay setup, transaction classification, and Net Worth calculations are
unchanged.

## Baseline and migration scope

Before this phase, pages used repeated, local Tailwind combinations for cards,
buttons, alerts, form controls, shadows, radii, and dark-mode colors. The
result was inconsistent visual density and interaction states. Several
financial displays also used truncation styles that could hide part of a
value.

This phase migrates the application frame and representative financial
workflows:

- layout header, theme toggle, and currency selector;
- dashboard error feedback and dashboard metric cards;
- Cash Flow summary metrics, FX and scheduled-income notices, actions, and
  Bank Activity controls;
- Net Worth summaries, connection form controls, account actions, and
  valuation feedback;
- the shared modal shell.

The Cash Flow insight rail deliberately retains its behavior: the 72rem main
area stays centered, the rail sits outside it on viewports at least 1816px
wide, and it becomes the existing accessible drawer below that width.

## Tokens

`frontend/src/index.css` owns the semantic tokens. It exposes them through
Tailwind 4's `@theme inline` mapping and as CSS custom properties.

| Token group | Examples | Purpose |
| --- | --- | --- |
| Surface | `ledger-bg`, `ledger-surface`, `ledger-elevated`, `ledger-subtle` | Page and layer hierarchy |
| Text | `ledger-text`, `ledger-text-secondary`, `ledger-muted` | Readable information hierarchy |
| Brand | `ledger-primary`, `ledger-primary-hover`, `ledger-primary-subtle` | Violet actions and selection |
| Semantics | `ledger-success`, `ledger-warning`, `ledger-danger`, `ledger-info` | Financial and system states |
| Shape | `ledger-radius-card`, `ledger-radius-control`, `ledger-radius-modal` | Consistent component geometry |
| Depth | `ledger-shadow-card` | Restrained elevation |

Light and dark values are defined together. Use semantic names rather than
hard-coded neutral or violet color strings in new shared UI.

## Shared primitives

Components in `frontend/src/components/ui/` are intentionally small and have
no dependency beyond React and Tailwind:

- `Button` — primary, secondary, outline, ghost, destructive; `sm`, `md`, and
  `lg`; disabled and loading states. Use `buttonClassName` on `Link` to retain
  navigation semantics.
- `Card` — default, subtle, highlighted, interactive.
- `FinancialMetric` — label, non-truncating tabular amount, supporting detail,
  and semantic tone.
- `Badge` — neutral, primary, success, warning, danger, and info.
- `Alert` — info, success, warning, and danger with `role="alert"`.
- `Field` — canonical control and compact select classes plus hint/error text.
- `State` — lightweight loading and empty-state cards.

`PremiumCard` remains as a compatibility adapter for the Dashboard API, but
now uses `Card` and avoids clipping financial values. The modal still handles
focus trapping, Escape behavior, focus restoration, and scroll locking; Phase
1 only updates its surface treatment.

## Usage guidance

- Use a `Button` for actions. Do not use it for navigation; apply
  `buttonClassName` to a `Link` instead.
- Use a semantic `Alert` for errors and notices instead of a one-off red,
  amber, or cyan panel.
- Apply `ui-control` / `controlClassName` to inputs and `selectClassName` to
  compact selects.
- Use `FinancialMetric` for money totals. Amounts use tabular figures and wrap
  when necessary; unavailable information should be explicit (`Unavailable`,
  `Incomplete`, or `—`) rather than rendered as zero.
- Keep semantic color supplemental to text labels. For example, a stale bank
  balance says that it is stale rather than relying only on amber color.

## Accessibility and responsive behavior

The foundation provides a visible keyboard focus ring, disabled controls,
semantic alert roles, dialog focus management, and a reduced-motion override.
The shared layout uses compact spacing from a 320px viewport upward, while
desktop actions retain room for their labels. Cash Flow's drawer still closes
by backdrop click or Escape.

Validate visual changes with an authenticated user at desktop, tablet, and
mobile widths in both themes. In a local frontend-only session, authentication
and account data require a running configured backend, so the data-bearing
Dashboard, Cash Flow, and Net Worth screens cannot be honestly verified with
real values. After starting the stack, sign in, visit those routes, toggle the
header theme control, and inspect at 1440px, 768px, and 375px widths.

## Next UI phases

Future phases can migrate remaining feature dialogs, transaction tables,
budget/routine pages, loan screens, charts, and admin screens onto these
primitives. They should not introduce a second styling system or alter Ledger
business behavior as part of visual work.

## Application shell and navigation (UI 2)

The authenticated workspace uses a compact sticky header and a centered main
container. Navigation never reserves a permanent side column, so feature
layouts—especially Cash Flow's independently positioned Insights rail—retain
their own centering rules.

The shared navigation model lives in `components/layout/navigation.ts` and is
used by both presentation modes:

| Section | Destinations |
| --- | --- |
| Overview | Dashboard |
| Cash Flow | Cash Flow |
| Planning | Monthly Routine, Monthly Budget, Monthly Close |
| Wealth | Net Worth, Saving Pot |
| Loans | Loan list and loan details |

On wide screens, Planning and Wealth use keyboard-accessible floating menus.
On smaller screens a single modal drawer exposes every destination. Both
versions mark the active route with text, a selected treatment, and
`aria-current`; menus close on Escape and outside interaction. The mobile
drawer locks background scrolling, restores focus to its trigger, and keeps
currency and theme controls available when header space is limited.
Planning navigation retains an active `year` and `month` query when moving
between its related pages.

`PageHeader` is the shared foundation for page context, descriptions,
breadcrumbs, metadata, and existing actions. It is deliberately optional so
feature pages can retain contextual month selectors and established workflows.

The router now lazy-loads feature pages while leaving authentication guards and
the app shell eager. The route fallback remains inside the shell, preventing a
navigation transition from replacing the global header.

## Dashboard command center (UI 3)

The Dashboard is a composition of existing read-only summaries rather than a
second financial-calculation layer. Its information order is current Net
Worth, current-month Cash Flow metrics, actionable attention, budget health,
trends, commitments, account health, and compact shortcuts.

`dashboard/financialAttention.ts` derives the attention list as a pure
function. It can surface only conditions already supplied by the existing
summaries: reliable budget overrun/80% utilization, incomplete valuation,
stale or unavailable balances, pending SePay review, an actionable previous
monthly-close state, and unavailable currency conversion. It never creates a
health score, prediction, deadline, or recommendation.

Dashboard monthly reporting uses `currentReportingPeriod` from `lib/date.ts`.
It intentionally follows the user’s local calendar month, consistent with the
monthly feature pages, while Net Worth remains explicitly labeled as a
separate current valuation. Missing, unavailable, and incomplete values are
shown as such; they are never rendered as financial zeroes.

## Monthly planning experience (UI 5)

Monthly Routine, Monthly Budget, and Monthly Close are one planning workflow:
baseline, spending control, then auditable review. `planningPeriod.ts` owns
the shared reporting-period parsing, local-calendar month stepping, and month
labels. It accepts direct valid `year`/`month` links, falls back safely for
invalid parameters, and lets browser history remain the source of navigation.
No planning page uses UTC month stepping for the user-facing reporting period.

`PlanningPageHeader` provides the compact stage navigation and the period
selector. It preserves the active `year` and `month` across Routine, Budget,
Month Close, and Cash Flow handoffs without adding routes or replacing global
navigation.

Routine distinguishes expected scheduled income and fixed commitments from
recorded variable activity. Its metrics describe their source instead of
claiming that scheduled amounts are bank-confirmed. Budget continues to use
the existing allocation and FX-completeness calculations, with Safe to Spend
as the leading financial position; planned savings remain a plan and are not
represented as a Saving Pot or bank transfer. Month Close keeps backend status
authoritative, presents its actual blockers and drift, and stores revisions
through the existing confirmation flows. A checkpoint never locks historical
transactions, and prior revisions remain visible.

Planning forms use the shared accessible modal foundation. Their draft
previews are explicitly unsaved, preserve validation, and never silently
rebalance allocations or create transactions, recurring entries, transfers,
or Saving Pot changes.

## Wealth management (UI 6)

Net Worth, Saving Pot, and Loans use the same Quiet Premium financial
surfaces. Net Worth keeps its valuation definition explicit: included bank
assets less loan liabilities. Saving Pot is a separate application ledger and
is never added as another Net Worth asset. Bank setup and disconnection are
deliberate modal workflows; connection methods and validation remain supplied
by the existing SePay API.

Saving Pot uses a primary adjustment workflow, a separate deliberate
correction path, and a ledger history that distinguishes automatic month-close
events from manual adjustments. Loans keep the portfolio visible by moving
creation into the shared modal shell; repayment schedules and contractual
amounts remain estimates, not bank-confirmed payment history.

## Cash Flow workspace (UI 4)

Cash Flow keeps its monthly content in a centered 72rem workspace. Insights
are not a second content column: at a viewport of 1816px or wider an 18rem
rail is positioned outside the workspace's left gutter, preserving the
workspace center. Below that breakpoint, the same compact insights content is
available from the header in the shared accessible drawer. The drawer has a
dialog role, traps focus, closes with Escape or its backdrop, locks background
scrolling, and restores focus to its trigger.

The compact header owns period navigation, the primary **Add transaction**
action, the Insights trigger, and one overflow menu. The overflow keeps
categories, weekly expenses, Monthly Routine, Monthly Budget, and Monthly
Close reachable without crowding smaller screens. Planning links retain the
active `year` and `month` query.

Monthly activity is one client-side view of existing recorded transactions and
scheduled entries. It supports search plus type, category, and source filters;
source labels make manual records, SePay records, scheduled income, and fixed
costs explicit. Scheduled rows are planning entries, not additional recorded
bank movements. Amounts and long descriptions are allowed to wrap rather than
being clipped.

The Insights surface contains a compact income-versus-expense view, category
spending breakdown, and a SePay review count. Detailed SePay classification is
opened only on demand in a review dialog. Its existing save guard prevents
double submissions; a successful save reloads the existing transaction,
summary, and activity data and communicates that no duplicate was created.
The Monthly Living Budget rule remains collapsible and only permits reliable
description/reference matching—amount alone is never a classifier.
