# Scoped Knip cleanup (2026-10-16)

Base: `main` at `9a8179e898f61fc0d55da7be1ac07e534248792d`, verified against
the remote before creating the isolated checkout. Root `AGENTS.md` was read;
this clone contains no `.agents/skills` directory.

## Reproduction and evidence

- Node **24.22.0**, Bun **1.4.0**, Knip **6.41.0** from `bun.lock`.
- Install: `bun install --frozen-lockfile --ignore-scripts`.
- Inventory: `node node_modules/knip/bin/knip.js --no-progress --reporter json`.
- Gate: `bun run lint:unused` (no flags or severity changes).
- `before.json` and `after.json` are the unmodified JSON reporter outputs.

| Issue | Before | After |
| --- | ---: | ---: |
| Files | 7 | 0 |
| Unused devDependencies | 3 | 0 |
| Unlisted dependencies | 1 | 0 |
| Exports (warning) | 42 | 42 |
| Types (warning) | 22 | 22 |
| Total | 75 | 64 |

The inventory exits **1** before and **0** after. The normal `lint:unused` gate
also exits **0** after. All 42 export and 22 type findings are identical after
sorting by file/symbol/location; none was suppressed or cleaned up.

## File review

Before removal, local `git grep -n -I` covered the tracked repository for the
seven paths/basenames and their exported symbols. The only outside matches were
historical changelog descriptions and unrelated admin `demoLeads` names.
Imports, barrels, configs, tests and dynamic discovery were checked locally:
there is no production `import.meta.glob`/`require.context` loader for these files;
the `fast-glob` matches belong to audits and architecture tests.

| Removed candidate | Active behavior retained |
| --- | --- |
| `cotizacion/domain/tiposContenedorDefault.ts` | `SeccionMercanciaMaritimaFCL` reads `useTiposContenedor`; catalog tests reject resurrecting excluded container types through a fixed list. |
| `cotizacion/hooks/wizard/usePrefillTarifaPricing.ts` | `useNuevaCotizacionPageController` calls `usePrefillContextoPricing`; `pricingTransfer` covers URL context, tenant/session boundaries and drafts. |
| `cxp/components/CuadreConceptosChip.tsx` | `DialogEditarConceptosFactura` renders `ImportesEdicionConceptos`; subtotal-derived editing tests remain intact. |
| `marketing/components/demoAccess/DemoAccessFields.tsx` | The disabled dialog never mounts a form or fields. |
| `marketing/lib/demoAccessSchema.ts` | The disabled form hook has no validation/access submission path. |
| `marketing/services/demoAccess.ts` | The disabled hook never invokes the Edge function or Auth. |
| `marketing/services/demoLeads.ts` | The disabled hook never writes leads; the separate admin reader remains intact. |

Paths in this table are relative to `src/features/`. No live implementation was
replaced. `DemoAccessDialog`, `useDemoAccessForm`, `demoAccessAvailability`, the
disabled button, Edge 503 behavior, SQL guards and their tests were left intact.

## Dependency decisions

- **Remove only root `@sentry/deno@11.6.0`.** Local consumers use
  `npm:@sentry/deno@11.4.0` in `supabase/functions/_shared/sentryRuntime.ts`.
  CI runs Edge with `DENO_NO_PACKAGE_JSON=1` and `--node-modules-dir=none`.
  The root SDK does not supply that runtime. Its four now-orphaned lock entries
  were pruned by Bun; frontend Sentry and the Edge import were not changed.
- **Keep `drizzle-orm@0.45.4` and `postgres@3.4.9`.** `drizzle.config.ts` uses
  PostgreSQL and `LOVABLE_DB_MIGRATION_URL`, with the existing migration history.
  Installed `drizzle-kit@0.31.11` (`bin.cjs`, lines 78944–78952) checks for
  `postgres`, then dynamically imports `postgres`, `drizzle-orm/postgres-js` and
  `drizzle-orm/postgres-js/migrator`. Root has no `pg` package. Knip's Drizzle
  plugin resolves the schema path but does not model those CLI driver imports.
  `scripts/db/test-proforma-fixture-lock-order.mjs` also imports `postgres`
  directly; that standalone tool is now an explicit Knip entry (it is analyzed,
  never executed). Only `drizzle-orm` needs an exception, scoped to workspace `.`
  for the CLI's dynamic imports. No connection or migration was executed.
- **Keep selector `pg` in its own manifest.** `run.cjs` and `concurrency.cjs`
  require `pg`; `scripts/ci/selector148/package.json` and its independent npm lock
  declare `npm:@supabase/pg@8.21.1`. Knip now analyzes that directory as a workspace.
  Its GitHub Actions plugin discovers `run.cjs`, `control.cjs` and `static-check.cjs`
  from `rls-tests.yml`; tests and `concurrency.cjs` are explicit entries because
  the runner spawns concurrency with a computed path. No root `pg`, global ignore,
  npm workspace or lock change was introduced for the selector.

## Validation

The six existing focused suites passed: **76 tests**, including disabled demo,
landing copy, offline release guards, container catalog, Pricing transfer and
concept editing. All six CI static database audits passed (`manifest`, `schema`,
`schema-functions`, `migrations`, `replay-mirror`, `rpc-sync`); these inspect files
and do not connect to a database.

Full validation commands: `bun run ci:local`, `bun run build`, and the unchanged
GitHub Actions workflows on the PR's exact commit. Final full-suite/CI status and
any platform-specific failures are reported in the PR description.

Windows checkout setup: restore authored LF bytes (the machine defaults to
`core.autocrlf=true`), use workspace-local temporary files, and add the fixed
Node/Bun/Git binaries to the child PATH. Initial CRLF/temp-path failures disappeared
with this setup; no tests or controls were weakened. Build processes omit
`SENTRY_AUTH_TOKEN`, with `ANALYZE=false` and `CI_REPORT_COMPRESSED_SIZE=false`,
so local validation does not upload artifacts.
