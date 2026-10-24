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
