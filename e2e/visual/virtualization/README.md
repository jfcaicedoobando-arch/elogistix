# Isolated virtualization and table keyboard smoke

Two synthetic scenarios exercise the production `useVirtualTableState` hook with
the production `VirtualRow`, and the production `VirtualTimeline` with its real
`FilaEntrada`. No virtualizer, ResizeObserver, row renderer or browser geometry
is mocked. Two additional scenarios use the production `DataTable` to check
native keyboard sorting in client and server modes. No production files are changed.

## Run in an authorized browser executor

Use a checkout of the exact commit under review with its frozen-lockfile
dependencies and matching Playwright browsers already provisioned. This suite
does not install software. From the repository root:

```sh
node node_modules/typescript/bin/tsc -p e2e/visual/virtualization/tsconfig.json
node node_modules/eslint/bin/eslint.js --no-cache e2e/visual/virtualization
node node_modules/vite/bin/vite.js build --config e2e/visual/virtualization/vite.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/virtualization/playwright.config.ts --list --project=chromium
node node_modules/@playwright/test/cli.js test --config e2e/visual/virtualization/playwright.config.ts
```

The final command first rebuilds this isolated fixture, then starts preview only
if that build succeeds. It never reuses an existing server or falls back to an old
bundle; the startup timeout includes the build. The separate build command above
is an optional early compilation check. Discovery does not build or launch preview.

The final command runs four scenarios in Chromium and the same four in Firefox:
eight executions, no retries or skips. `--project=chromium` or `--project=firefox`
selects four executions only. Both projects use the unmodified built-in Desktop
device descriptor. Firefox runs the real user-agent-dependent measurement path;
its user agent is not spoofed in Chromium. Discovery does not launch a browser.

Require `reports/virtualization/results.json` stats to show `expected: 8`,
`unexpected: 0`, `skipped: 0`, `flaky: 0` for a full run (expected is 4 when
selecting one project). A missing browser or occupied port is a blocker, not a
passing or skipped test. Do not substitute an app/staging E2E configuration.

## Assertions

Each scenario uses 240 stable synthetic IDs and materially different measured
heights, then checks:

- Fewer than 60 mounted rows, positive and varied actual browser heights.
- Real mouse-wheel scrolling, an intermediate-position layout/ID/height check
  before any jump to the end, and full visibility of the final record.
- A large scroll and data replacement in the same animation frame, keeping even
  IDs and reversing their order without resetting or remounting the consumer.
- Exact ID at every mounted data index, no duplicate/removed IDs, and consecutive
  indices with no overlap (1px tolerance) or gaps above 2px after measurements settle.
- No uncovered viewport area, and the new first and final records reachable.
- Restore, filter again, remount, and repeat the final-record check.
- Zero console/page errors, forbidden requests or WebSocket attempts.

`expect.poll` waits for actual layout convergence without arbitrary sleeps;
it does not assert that intermediate pre-convergence animation frames are free
of every visual jump. Screenshots and JSON geometry facts are attached. These
are component/layout smoke tests, not staging ERP workflows, accessibility
certification, pixel baselines or proof about the full app's scroll containers.

## Native table keyboard cases

The client and server sorting cases use a real browser keyboard. Tab from a
preceding button reaches the sortable header; Enter and Space each advance
`aria-sort` by one state and preserve focus. The tests check `:focus-visible`
and the computed focus ring, then attach screenshots and computed facts.
The client case checks the real row order; the server case checks exactly one
callback per activation and keeps the supplied row order. The non-sortable
header has no button or tab stop and does not change the sort.

These cases do not dispatch a synthetic click to emulate key activation.
The existing jsdom regressions remain unit-level coverage and do not certify
native browser keyboard behavior. To run only the four new executions:

```sh
node node_modules/@playwright/test/cli.js test --config e2e/visual/virtualization/playwright.config.ts keyboard-sorting.spec.ts
```

Local follow-up on 2026-10-16 (Windows, Node 24.19.0, Playwright 1.64.0):
the fresh build, isolated typecheck and ESLint passed. Chromium revision 1248
passed all four scenarios, including both native keyboard cases. The complete
run reported four passed and four failed: Firefox revision 1555 could not launch
before any assertions (`browserType.launch: spawn UNKNOWN`). Running its
headless `--version` directly confirmed a Windows side-by-side configuration
error. Firefox is therefore unverified locally; the existing Linux CI job still
requires all eight cases with no skips or retries. JSON facts and focus-ring
screenshots are attached to the Playwright results under `reports/virtualization`.

The subsequent [Linux CI job](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38953429217/job/117150244096)
on head `d4ac95df9ce81f95251b77a7c6afd4bd08229a79` passed all eight cases
in 18.0 seconds, including native keyboard sorting in both Chromium and Firefox.
Its exact-count gate passed with zero unexpected, skipped or flaky cases.
The separate main CI run on that head stopped at test-catalog registration;
that result does not certify the unit/build lanes, which require the next run.

## Isolation

The standalone build never loads the app's Vite configuration, `.env` files,
`.env.e2e`, public assets, auth, provisioning or a backend. `envDir: false` disables
Vite env-file loading. The build fails if app bootstrap, backend services,
Supabase, Sentry or the runtime shared-hooks barrel enters the module graph.
Only a TypeScript path maps the `EntradaBitacora` type-only barrel reference to
its real canonical `src/types/bitacora.ts`; runtime consumer imports are intact.
The normal stylesheet and visual-suite Tailwind/PostCSS configuration are reused.

Playwright builds the synthetic fixture before serving it on `127.0.0.1:8098` with
`reuseExistingServer: false`. Routes allow only GET `/` and `/assets/*` on that
origin. CSP denies connections and forms; WebSockets and service workers are
blocked. This does not invoke the existing 28 isolated UI cases or any normal
E2E global setup. Artifacts contain synthetic data only, under `test-results/`
and `reports/`; never add real customer data, credentials or session cookies.

## Historical candidate preparation status (PR301)

Prepared against PR301 head `2ee7bfdbeb7ad6df6d4df5dc4b1c269fd75ec145`, base
`ee8ba3ac15720680a1d2de82eaec2e1bd73ece96`. That comparison changes only
`package.json` and `bun.lock`; the two consumer source blobs are unchanged.
Local typecheck, ESLint, isolated build and discovery passed with previously
available dependencies, including React Virtual 3.14.13 and Playwright 1.63.0.
These are not the candidate's React Virtual 3.14.14 / Playwright 1.64.0 dependency
set. No browser was launched, no backend was contacted, no dependency installed,
and no remote file or workflow was changed during preparation. This candidate adds one `virtualization` job to the existing isolated UI workflow,
keeping its original 20- and 8-case jobs unchanged. The new job records the tested
commit, lockfile hashes, dependency versions and browser revisions, and requires
all four cases to pass. It has not been published or executed in CI yet. Repeat checks
with the exact candidate dependency set and execute both browser projects before
calling the PR's virtualization smoke validated.
