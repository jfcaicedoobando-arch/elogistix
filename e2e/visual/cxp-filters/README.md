# CxP filter focus regression

The real `CxpFiltros`, `useCxpPageState`, draft hook, Sheet, Select, router and nuqs
adapter run in a standalone production build. Only supplier/category hooks return
synthetic options. No app bootstrap, credentials, public assets, Supabase or Sentry
are loaded: the build rejects those imports, CSP blocks connections, and tests
reject external/mutation requests and WebSockets.

From the repository root, using the runtime and frozen dependencies configured by
`.github/actions/setup-bun`:

```sh
node node_modules/typescript/bin/tsc -p e2e/visual/cxp-filters/tsconfig.json
node node_modules/eslint/bin/eslint.js --no-cache e2e/visual/cxp-filters
node node_modules/@playwright/test/cli.js test --config e2e/visual/cxp-filters/playwright.config.ts
```

The Playwright command builds a fresh fixture before serving localhost:8103.
The isolated UI workflow runs all 12 tests and requires zero skips/retries.
Results are written to `reports/cxp-filters/results.json`; failures retain traces
and screenshots in `test-results/cxp-filters/`. No screenshot baseline is updated.

## Coverage

- 390×844 and 1280×900: two X cycles without edits.
- Each viewport: two cycles each of X, Cancelar, Escape and Aplicar after editing
  the status. Check focus on the visible Filtros button and the original DOM node.
- Cancel leaves all applied filters, search and the real URL unchanged; reopening
  resets the draft. Apply changes only status and resets pagination, retaining
  the other query parameters. Unit tests also cover clear/apply callbacks once.
- Both resize directions while the Sheet is open, twice: retain the draft and
  original trigger, then Cancel restores focus and preserves URL/applied values.
- The count remains 8 on mobile and 7 on desktop with Origen active.

The Select must finish its native exit/focus handoff before Escape is sent to the
Sheet. The helper waits for actual listbox unmount and focus, with no forced focus,
animation disabling, arbitrary delay, retries or relaxed assertions.

## Baseline and scope

Baseline main: `7feb1fd730bff13c790b944096d17f7a30ee9e4b`. Before the fix, the new
mobile X case failed focus restoration; the desktop case failed DOM identity.
Both unit cases for the unique/stable trigger failed on the unmodified component.
The earlier isolated comparison also reproduced mobile BODY focus twice on both
Tailwind 3 (`b1e3e00f15c8870feebc0b7085701589f4b6081f`) and main Tailwind 4.

Product change is confined to `CxpFiltros.tsx`: one responsive bar/search/trigger,
module-level FilterButton, unchanged desktop Origen and viewport-specific counts.
No changes to shared Sheet, UnifiedFiltersBar, Tailwind, draft/URL hooks, business
rules, dependencies, migrations, secrets or deployment configuration.

Local evidence uses Chromium 156.0.8078.4, Windows and Node 24.22.0. The original
synthetic closed-panel capture is byte-identical at 390×844. At 1280×900 the trigger
rectangle is identical; 31 RGBA pixels differ by at most 1/255 in rounded corners.
These observations cover the isolated fixture, not authenticated application data
or other browsers. Baseline/result hashes and local checks are in `evidence.json`.
