# CRM legacy route cascade — 2026-10-16

Base: remote `main` at `c1d86c349b80faa7489d250440924ea77848c57d`, verified
before creating `codex/knip-commercial-cascade-20261016` in the isolated clone.
This follows the merged PR 383 and uses the explicitly expanded commercial
assignment. Existing root/CRM `AGENTS.md` are unchanged; `.agents/skills` is
absent. The first cleanup's evidence and route-removal probe are preserved in
the parent directory.

## Inventory

Same frozen dependencies and runtime: Bun **1.4.0**, Node **24.22.0**, Knip
**6.41.0**. The baseline reporter matches PR 383's `after.json` exactly after
sorting, including symbol locations. Both reporter runs use:

```sh
node node_modules/knip/bin/knip.js --no-progress --reporter json
node docs/qa/knip-commercial-20261016/cascade/compare-inventory.mjs
```

| Finding | Before | After |
| --- | ---: | ---: |
| Exports | 26 | 24 |
| Types | 16 | 16 |
| Files/dependencies/unlisted/duplicates | 0 | 0 |
| Total | 42 | 40 |
| Remaining commercial warnings | 2 | 0 |

Both route warnings are removed, **zero findings added**. JSON reporter
outputs are unmodified in `before.json` and `after.json`; `comparison.json`
contains the normalized delta. No Knip configuration, suppression or severity
change was made. Financial/shared findings remain outside this assignment.

## Local reference review and removal decisions

`git grep -n -I` searched the tracked repository for the module names, paths
and symbols before editing. Snapshots are `references-before.txt` and
`module-loaders-before.txt`; historical evidence JSON is excluded as it is
not a consumer. A separate review covered namespace/barrel exports, test
imports and computed imports. No glob or computed loader consumes these
modules; the only lazy loads are the two authorized declarations.

- Remove `Leads` / `CrmProspectos` from `appRoutes.lazy.ts`.
- Delete only the six authorized legacy files: `components/LeadsBulkBar.tsx`,
  `routes/Leads.tsx`, `routes/LeadsFiltrosPrimarios.tsx`, `routes/Prospectos.tsx`,
  `routes/useLeadsExport.ts`, `routes/useLeadsSelection.ts` under
  `src/features/crm/`. They form a closed legacy subgraph: the two lazy imports
  point to the pages; `Leads` imports the four remaining files. No active route
  mounts either page: `crmRoutes.tsx` already redirects both to Empresas.
- Remove only `exportarLeadsCsv`: its sole caller is the deleted export hook.
  Preserve `buildLeadsCsv`, `buildOportunidadesCsv`, `sufijoFechaArchivo` and
  `exportarOportunidadesCsv`, with all their imports. Opportunity export stays
  active in `useOportunidadesFiltrosServidor.ts`.
- Remove only `LEAD_SORTABLE_KEYS`: only the two deleted pages consume it.
  Preserve `LeadSortKey`, `LeadFiltros`, `LEAD_COLUMNS`, stages, state catalogs
  and all shared helpers.
- Remove only `listLeadsTodos` and its exclusive `leerTodasLasPaginas` import.
  Its only caller is the deleted hook, via the wildcard query barrel. Preserve
  `aplicarFiltrosLeads`, `listLeads`, `getLead`, `getNombreLead` exactly,
  including filters, pagination, tie-break order and soft-delete behavior.
  Existing hooks and prospect selectors still consume those query contracts.

Serializers, columns, counters and bulk hooks/services with tests or active
consumers are retained. `QuickAddMenu → QuickAddFullDialogs →
ImportarLeadsCsvDialog → useImportarLeadsCsv → useCrearLeadsBulk` stays intact,
including its permission gate. No SQL, roles, data, fiscal action, merge or
deployment is part of this branch.

## Preserved-contract evidence

`check-preserved-contracts.mjs` compares 11 protected TypeScript declarations
and four whole files with the exact base. `preserved-contracts.json` records
their SHA-256 digests. The unchanged whole files include `crmRoutes.tsx`,
QuickAdd menu/full dialogs and the CSV import dialog. The parent directory's
`check-route-contract.mjs` additionally asserts the exact redirect targets
`/crm/empresas?estado=Lead` and `/crm/empresas?estado=Prospecto`, `replace`, and
the `leads/:id` route with `LeadDetalle`. No legacy UI is reinstated or redesigned.

## Coordinated shared-test adjustment

Reference review found one additional file outside this cascade:
`src/hooks/shared/__tests__/pagedListsAllowlist.test.ts:24` reads `Leads.tsx`
literally in two parameterized assertions. Its existing entry becomes stale
when the page is removed. The proposed adjustment is to remove only that
obsolete entry while preserving both assertion bodies and every live route.
This was reported before editing. The user then assigned this one test
exclusively to the commercial continuation and confirmed that the shared author
would not edit it. The final test diff removes exactly the one `Leads.tsx`
entry; both assertion bodies and all six live entries remain byte-identical.
`check-preserved-contracts.mjs` verifies that the complete final file equals
the base file with only that exact line removed, recording the proof in
`preserved-contracts.json`. No exception, skipped test or weaker assertion was
introduced.

The initial focused run is preserved in `allowlist-before-output.txt`: 12 passed
and two `ENOENT` failures for the removed page. The corrected run in
`allowlist-output.txt` passes all **12 cases** for the six live routes: Cartera,
CxP Por pagar, CxP Aging, Comisiones, Actividades and Cotizaciones.

**Empresas was not covered by `MIGRATED_ROUTES` before this change.** Its page
delegates to `ListaObjetosCrm → useListaObjetosCrm`, not to
`useServerPagedList`/`useClientPagedList`. Inserting Empresas into this specific
guard would assert a migration that has not happened. No entry or exception is
added for it, and no active page's existing checks are removed. The existing
`ListaObjetosCrm.test.tsx` suite is retained and run separately: **five tests
pass**, covering pagination/search/navigation and the Empresas URL state filter
(including `?estado=Prospecto`). Empresas, its list component and hooks remain
unchanged.

## Validation

- TypeScript build check: **pass** (`types-output.txt`).
- Frontend production build: **pass** (`build-output.txt`).
- Commercial focused tests: **17 files / 181 tests passed**, including all six requested
  suites (`crmCsvExport`, `listLeads`, `queries`, `leadsBulk`,
  `leadsPermisosConsumo`, `LeadDetalle.render`) plus CSV round-trip/import,
  QuickAdd, bulk service and route smoke/guard contracts (`tests-output.txt`).
- Coordinated allowlist and existing Empresas list tests: **two files / 17
  tests passed** (`allowlist-output.txt`, `empresas-output.txt`), for **19 files
  / 198 passing tests** across the focused runs.
- Exact preserved declarations/files and route structure: **pass**.
- Full ESLint with `--max-warnings=0`: **pass**, zero warnings (`lint-output.txt`).
- Normal Knip gate, without severity flags: **pass** (`knip-output.txt`).
- `git diff --check`: checked before commit.

The output text files retain results with trailing spaces/excess final blank
lines trimmed; JSON reporter output is unmodified. Validation uses the fixed
runtime and workspace temp directory; build omits `SENTRY_AUTH_TOKEN`, sets
`ANALYZE=false` and `CI_REPORT_COMPRESSED_SIZE=false`, and uploads nothing.
Known Windows Bash/symlink full-suite failures are not rerun. Exact remote CI
status belongs in the PR description/final handoff so recording it does not
create a new commit after the checked SHA.
