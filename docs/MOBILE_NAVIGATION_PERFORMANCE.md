# Mobile navigation performance profile

## Changes

- Added one in-memory TanStack Query client for shared financial server state. Query keys include the authenticated user and, where relevant, reporting period, currency, and filters. The cache is cleared at logout, session loss, and account change; no financial response is persisted to browser storage.
- Migrated dashboard, cash-flow, net-worth, budget, planning, bank-activity, category, recurring-item, loan, and Saving Pot reads to shared queries. Previously loaded data remains visible during background refreshes; different months, currencies, loans, and accounts cannot overwrite one another.
- Added targeted invalidation for financial mutations, with query freshness tuned by data type and reporting period.
- Kept the app shell and mobile navigation outside the routed outlet. Primary route modules can preload on intent, while only Dashboard is eligible for idle preload; Data Saver and slow-2G skip that work.
- Deferred mobile Dashboard charts, budget, and monthly-routine requests until “More financial insights” is opened. Less-frequent screens remain code-split. First-load routes have compact, named skeletons.

## Before/after browser profile

Profiled five serial runs before and after the change at a 390 × 844 Chromium viewport. The baseline was commit `53432c1`; both builds used the same Playwright route fixture, Vite development server, clock, click path (Dashboard → Cash Flow → Net Worth → Dashboard), and React Strict Mode. Active-tab feedback is measured from the tab click to two animation frames after its `aria-current="page"` state changes. API responses are mocked, so this isolates client-side navigation and request counts—not server or real-network latency.

| Measure | Before | After | Result |
| --- | ---: | ---: | --- |
| Tap to painted active-tab state, median of 5 | 112 ms | 109 ms | 3 ms faster; ranges were 101–154 ms and 101–130 ms |
| Cash-flow summary requests across the route sequence | 6 | 1 | 5 fewer; revisiting Dashboard makes no extra request |
| Net-worth summary requests across the route sequence | 6 | 1 | 5 fewer; Dashboard and Net Worth share the response |
| Net-worth account-list requests across the route sequence | 6 | 1 | 5 fewer |
| Mobile Dashboard trend requests before opening insights | 2 | 0 | Deferred until the user opens insights |

The request counts are from the development build, where Strict Mode intentionally remounts effects; production will not have that initial double-effect amplification. The key outcome is that cached revisits made no additional summary or net-worth requests. The measured tab-state improvement is small, not a claim of a large rendering-speed gain. The 100 ms target was not met in these five post-render samples; continue profiling and optimizing on representative physical phones before treating that target as achieved.

Production bundle inspection shows the Dashboard route chunk reduced from 9.92 KiB to 6.49 KiB gzip. Its 4.63 KiB-gzip financial-trends module is now a separate lazy chunk, so mobile does not download the charts before opening insights. The shared query runtime adds a 2.91 KiB-gzip chunk and the overall entry bundle grows from 83.81 KiB to 92.26 KiB gzip (+8.45 KiB); this is the trade-off for centralized caching, background refresh, and mutation invalidation.

## Build and testing

- `npm run lint` — pass.
- `npm run build` — pass; route code splitting remains enabled, and the Dashboard trend module is now separately lazy-loaded.
- `npm run test:e2e` — 60 Chromium tests, including cache reuse, mutation invalidation, deferred mobile insights, and account-switch isolation.

## Not verified here

No physical Android or iOS device, Safari, poor-network profile, production API, field INP, or long-task telemetry was available. The browser test uses a responsive Chromium viewport and mocked APIs; it cannot certify real-device paint/INP or backend latency. Device and browser validation remains necessary before making cross-platform performance claims.
