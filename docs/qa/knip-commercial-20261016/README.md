# Commercial Knip cleanup — 2026-10-16

Base: `main` at `b500565363af0fc566decb7327c717da61cfabd7`, verified with
`git ls-remote origin refs/heads/main`. Isolated clone/branch:
`codex/knip-commercial-20261016`. Both root and CRM `AGENTS.md` were read;
this checkout has no `.agents/skills` directory.

## Reproduction

Node **24.22.0**, Bun **1.4.0**, Knip **6.41.0** (frozen `bun.lock`).
Installed with `bun install --frozen-lockfile --ignore-scripts`. Authored LF
bytes were restored after the machine's default autocrlf checkout, without
changing tracked content. Before making source edits, the JSON inventory
matched the pinned `knip-scoped-cleanup-20261016/after.json` exactly after
sorting, including file, symbol, namespace, line, column and position.

```sh
node node_modules/knip/bin/knip.js --no-progress --reporter json
node docs/qa/knip-commercial-20261016/compare-inventory.mjs
node node_modules/knip/bin/knip.js --no-progress
```

`before.json` and `after.json` retain the unmodified reporter output.
`comparison.json` lists every removed finding and the route-removal probe.

| Finding | Before | After |
| --- | ---: | ---: |
| Exports | 42 | 26 |
| Types | 22 | 16 |
| Files / dependencies / unlisted / duplicates | 0 | 0 |
| Total | 64 | 42 |
| Assigned commercial findings | 24 | 2 |

**22 findings removed, zero new findings.** Normal Knip gate and JSON reporter
exit 0; no severity, configuration, dependency, workflow or database changes.

## Decisions and preserved contracts

The local tracked repository was searched with `git grep -n -I`, including
imports, namespace consumers, compatibility barrels, tests, scripts and
dynamic loads. Search snapshots are `references-before.txt` and
`dynamic-imports-before.txt`; these exclude the old inventory JSON to avoid
counting the findings themselves as consumers. There is no production
`import.meta.glob` or `require.context` loader for these modules. Computed
imports found in changelog, fiscal tools and typecheck do not consume them.

| Assigned file / symbols | Decision and live behavior retained |
| --- | --- |
| `lib/access/permissionMatrix.ts`: six CRM lists and `PermisosCrmResueltos` | Remove only redundant reexports. `permissionMatrix.crm.ts` retains every role list, resolver and canonical type. `CRM_ESCRITURA_REGISTROS` and `resolverPermisosCrm` remain in the barrel for `VendedorSelect` and `usePermissions`; RLS/permissions are unchanged. |
| `cliente/hooks/useNuevoClienteController.ts`: `DOCS_OBLIGATORIOS`, `EMPTY_CLIENTE` | Remove only reexports; imports and internal initialization, checklist and reset uses remain. `DOC_CSF` and form types stay exported for existing consumers/tests. |
| `costeo/services/topTarifas.ts`: `fetchTarifaVigentePorId` | Remove unused singular helper. Its only remaining names outside the declaration are unused keys in two test mock objects. Production Pricing uses `fetchTarifasPricingOrganizacion` and `fetchTarifasVigentesPorIds`; paginated/capped multi-ID query and top tariff ordering are unchanged. |
| `cotizacion/services/queries.ts`: `fetchCotizacionSello` | Remove legacy helper and its unused barrel reexport. Draft restore uses the coherent `fetchCotizacionDraftSnapshot` plus `resolverContenidoBorrador`; tenant, snapshot, conflict and live-row checks stay intact. `fetchCotizacionSelloSync` is a separate active contract and remains intact. |
| `crm/domain/leads/icp.ts`: `ICP_ESTATUS` | Remove unused projection only. Canonical `ICP_ESTATUS_OPCIONES`, historical-value normalization and ICP gates remain intact. |
| `crm/services/pricing/tiposPricing.ts`: `HORAS_POR_COMPLEJIDAD` | Remove unused client map only. `ETIQUETA_COMPLEJIDAD` remains unchanged. Effective SLA calculation stays in the existing Pricing RPC (baseline SQL uses 8/24/48 hours); frontend sends through RPC and consumes returned timestamps. |
| `cotizacion/services/index.ts`: `buildConceptosFromCostos`, `CotizacionCostosSnapshot`, `UpsertCostosResult` | Remove only unused reexports. Direct domain imports and original `costos.ts` return contracts remain, with full cost/concurrency tests intact. |
| `crm/services/vincularCotizacion/index.ts`: `propagarConversionProspectoCRM` | Remove only barrel export. Direct implementation and tests for RPC/bitácora remain. Current `prospecto.ts` conversion still uses the atomic conversion RPC and forbids duplicate post-conversion propagation. |
| `cotizacion/hooks/usePendientesReaprobacion.ts`: global hook | Remove unconsumed global hook/import only. The per-user hook retains email, `enabled`, query key, stale time and count query. Global count service remains for its direct soft-delete test contract. |
| `crm/services/higiene.ts`: `EstadoHigiene` | Remove only redundant type reexport. Canonical type and direct `higieneMetas.ts` consumers remain; RPC calls and fallback summary are unchanged. |
| `cotizacion/hooks/wizard/useCotizacionUpdateGuard.ts`: `CotizacionUpdateGuard` | Remove unconsumed interface only. Hook, active interfaces, expected stamps, resynchronization, create stamp and mutation contracts are unchanged. |
| `cotizacion/domain/frecuencias.ts`: `FrecuenciaCotizacion` | Remove unconsumed type alias only. Catalog and prefill membership behavior stay intact. |

Paths in this table are relative to `src/` (feature paths omit `features/`).
No tests or assertions were removed or weakened. Existing surplus mock keys
were left alone because they neither consume the actual export nor affect the
tested contracts.

## Deferred routes: explicit scope boundary

`src/routes/appRoutes.lazy.ts` is unchanged. The two findings `Leads` and
`CrmProspectos` remain pending a coordinated cleanup. Temporarily removing
their declarations produced `after-probe.json` (exit 1) with **six new file
errors** outside the authorized list:

- `src/features/crm/components/LeadsBulkBar.tsx`
- `src/features/crm/routes/Leads.tsx`
- `src/features/crm/routes/LeadsFiltrosPrimarios.tsx`
- `src/features/crm/routes/Prospectos.tsx`
- `src/features/crm/routes/useLeadsExport.ts`
- `src/features/crm/routes/useLeadsSelection.ts`

It also exposed three exports: `exportarLeadsCsv`, `LEAD_SORTABLE_KEYS`,
`listLeadsTodos`. None of these files was edited. Keeping the existing lazy
declarations is an explicit deferral, with no new artificial consumer or Knip
suppression. The cascade was reported for coordination before expanding scope.

`crmRoutes.tsx` and the active redirects remain unchanged. The executable
`check-route-contract.mjs` asserts exact destinations
`/crm/empresas?estado=Lead` and `/crm/empresas?estado=Prospecto`, both with
`replace`, and preserves `leads/:id` → `LeadDetalle`. This supplements the
general route smoke test, which alone does not prove those destinations.

## Validation

- `node node_modules/typescript/bin/tsc -b`: **pass**.
- `node node_modules/eslint/bin/eslint.js . --max-warnings=0`: **pass**, zero warnings.
- `node node_modules/vite/bin/vite.js build`: **pass**.
- Focused Vitest (`--maxWorkers=2`): **51 files, 523 tests passed**. Full filters
  and command are recorded in `tests-output.txt`.
- Focused coverage includes permissions/ownership, client CSF/lifecycle/save,
  tariff catalog/equivalence/pagination, draft snapshot/restore/finalization,
  stamp/concurrency guards, costs, Pricing transfer, atomic prospect conversion,
  direct propagation, ICP and hygiene, lead detail, and route guards/smoke.
- `node docs/qa/knip-commercial-20261016/check-route-contract.mjs`: **pass**.
- `git diff --check`: **pass**.

Validation child processes use the fixed Node/Bun binaries and workspace temp
directory. Build omits `SENTRY_AUTH_TOKEN`, sets `ANALYZE=false` and
`CI_REPORT_COMPRESSED_SIZE=false`; no sourcemaps are uploaded. The known
Windows Bash/symlink full-suite failures were not rerun. Linux PR CI supplies
the full validation on the exact pushed SHA; its live status is recorded in
the PR description and final handoff. No database connection, fiscal action,
merge or deployment was executed.

Versioned `*-output.txt` logs preserve command results with trailing spaces
and excess final blank lines trimmed; JSON reporter files are unmodified.
