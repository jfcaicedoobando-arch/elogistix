# Isolated UI audit 119/126

Exercises the real `CerrarFacturaSinPagoDialog` (including shared dialog and
invoice context) and `FacturaPagosMobileCard` components without starting the
application. The GitHub Actions workflow is `Isolated UI audit (119/126)`;
it runs on pull requests and manual dispatch, with read-only repository permission.
It is independent of the staging E2E suite and its provisioning/mutators.

## Run

Use the repository's frozen lockfile installation and Playwright version:

```sh
bun install --frozen-lockfile --ignore-scripts
node node_modules/@playwright/test/cli.js install --with-deps chromium
node node_modules/typescript/bin/tsc -p e2e/visual/audit119-126/tsconfig.json
node node_modules/vite/bin/vite.js build --config e2e/visual/audit119-126/vite.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/audit119-126/playwright.config.ts
```

To check discovery without launching a browser, append `--list` to the final
command. Browser execution requires an environment that permits Chromium IPC;
compilation, typechecking and discovery alone do not establish a GUI pass.

## Coverage

Exactly 20 cases: five viewports (1180×757, 1280×720, 691×763, 691×420,
390×640), light/dark, and 100%/150% root font size (16px/24px). This is text
enlargement, not browser zoom. Locale, timezone, clock and reduced motion are fixed.
The fixture uses the normal stylesheet and system sans-serif fallback, with no
external font download.

Each case checks:

- Active: MXN 20.00 received, USD 1.00 applied; cancelled: MXN 20.00 historical,
  USD 0.00 applied; full currency/amount tooltips, including narrow cards.
- No card/page/dialog horizontal overflow; dialog viewport containment and
  internal mouse-wheel scroll; keyboard-accessible fields and footer.
- Keyboard open, select Condonación (Home → ArrowDown → Enter), focus trap in both
  directions, required reason and typed
  confirmation, Volver, reopen with cleared fields, and Escape.
- Zero calls to the synthetic confirm handler; no production financial action
  is ever invoked.
- Zero external requests, non-GET requests, WebSockets, or browser/console errors.

Screenshots (cards, initial modal, top, footer), JSON facts, HTML results and
failure traces are evidence for review. These are functional/layout checks with
screenshots, not pixel-baseline comparisons or a production/staging E2E pass.

## Isolation and artifacts

All invoice/payment records are synthetic. Backend hooks and Supabase are
aliased to throwing stubs; download UI is absent. The fixture build fails if app
bootstrap, the real Supabase client, Supabase SDK or Sentry enters its module graph.
The standalone Vite configuration uses an empty env directory, no normal app
configuration, no public assets and no source maps. Tests serve only the compiled
fixture on `127.0.0.1:8096`. Browser routes allow GETs only to that exact fixture
origin/static paths; WebSockets and service workers are blocked, and the page's
CSP denies connections and form submission.

The workflow supplies no secrets and uploads only synthetic test evidence and
logs, on success or failure, with three-day retention. This repository is public;
artifacts follow GitHub's public-repository access rules and are not private.
Do not put real records, credentials, cookies or customer data into this fixture
or its attachments. Generated build/test output stays in ignored
`test-results/` and `reports/` directories.
