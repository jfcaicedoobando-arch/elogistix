# Audit135: isolated forward candidate

Functional draft candidate against main `ce8d33a1f482cc6f7be674956c481acaa53ca791`. No application release number, remote SQL or deployment is assigned. The original split provenance and evidence below are retained; current-main integration is recorded at the end.

## Original split provenance and scope

- Base: main after PR170, `19a5c07`.
- Source: `eaf4024a3484ffbc8fbbb8cab7b4ec7ac53cf035`.
- Reviewed composition: `6b0b36264b69bf5676d856daab4de054d69d4533`.
- Branch: `split/audit135-forward-local`.
- Migration: `20261006233700_audit135_anticipo_cronologia.sql`.
- SQL SHA-256: `8703fd2ddb3764bd5dec415ada4be55cae32fcf0568068ac21846f809ae8916f`.

SQL bytes match the original135 migration and the composition's `20261006212900` file exactly. Only this unpublished candidate's filename changes. Neither older filename is included in this branch. Main's audit144/proforma files remain immutable.

The complete RPC replacement adds only eight source-date-guard lines to main's function body. An application cannot precede its advance or supplier invoice. Existing role checks, idempotency, closed-period/future-date guards and FX calculations remain intact. UI minimum dates expose the rule without silently changing captured date or amount.

No131/134/139, policy148, P&L, Aging or Por Pagar snapshot is included. Audit140 already in main is not copied again. The new canonical mirror matches this migration; baseline changes only the eight function-body lines, leaving ACL and unrelated objects unchanged.

## Forward order and remote uncertainty

The composition's212900 sorts before audit144's already-published213000. A clean replay is not proof that default CLI will apply a missing migration older than an installed database's high-water mark.

Main's newest committed SQL at preparation is223000. The separately coordinated proforma35 candidate uses225000 and230000. The new233700 follows them, without reserving an application release version. The actual remote Supabase and Lovable/Drizzle histories have not been inspected here. Verify both before publication/application. If a later target version appears while135 remains unpublished, re-date only this candidate and rerun replay; never rename an already-applied file.

## Proposed explicit release/application procedure

1. Parent coordinates the application release and adds this intended new migration to that release's manifest. Do not weaken the manifest guard or assign this to an older release merely to make CI pass.
2. Recompose onto approved current main, including proforma35 if landed. Recheck SQL hash, unique forward timestamp, canonical/baseline function and focused tests.
3. Before any separately authorized remote execution, identify the exact target. Read both `supabase_migrations.schema_migrations` and `drizzle.__drizzle_migrations`, plus the current RPC definition/permissions. Record its pre-change hash. A newer/different target function requires reconciliation rather than overwriting it.
4. If the target uses the Supabase migration path, inspect `supabase migration list --linked` and `supabase db push --linked --dry-run` from the exact release checkout. Proceed only if the plan contains the intended forward135 SQL and no unapproved history/other work. Drift or extra migrations block execution; they do not authorize `--include-all`, `migration repair`, reset or manual history edits.
5. Only with separate database authorization, execute the reviewed forward plan through the target's existing migration mechanism and its successful-execution registration. If Lovable/Drizzle is the actual writer, prepare an explicitly reviewed forward action in that mechanism instead; a GitHub merge or Supabase plan does not establish that it ran there.
6. Verify registered version/hash, resulting function and unchanged effective permissions. Use separately authorized non-production functional checks for earlier-date rejection, the minimum valid date and same-request retry without duplicates. Frontend deployment remains separate.

The official CLI documents timestamp comparison in `migration list`, a non-applying plan from `db push --dry-run`, and expansion to all missing remote-history entries with `--include-all`. Sources: [migration list](https://supabase.com/docs/reference/cli/supabase-migration-list), [db push](https://supabase.com/docs/reference/cli/supabase-db-push). No CLI command above was run against a remote database.

## Verification

- Isolated PostgreSQL17.9 full replay passed on this branch.
- Forward replacement over main's actual function body passed; effective ACL, owner, security mode and search_path were captured and are exactly unchanged.
- Four ordinary suites passed and rolled back:135 chronology, advance cash/dates/DOF cross-currency, no duplicated bank charge, and payment deletion reversing an advance.
- Reapplying135 and repeating the chronology/retry suite passed. Its added same-request assertion keeps one application/payment as one.
- Migration hygiene, schema-function integrity, canonical replay mirror and test hygiene passed. Existing exact schema divergences remain unchanged.
- The manifest intentionally reports exactly one new unassigned migration; application version and manifest have not been edited.

All 26 frontend tests passed in six focused files with one worker and a 1.5 GB heap. Changed-file ESLint passed without warnings. No blocked security suite, broad CI grant fixture, build, remote CI, live database or browser certification is claimed. The combined source already passed app/node types under 3 GB, but this isolated branch's full typecheck has not yet been rerun.


## Functional draft on current main

The reviewed135 commit `0211458a7100af3ddab858618e3ecfd6ba75c013` is recomposed directly onto main `ce8d33a1f482cc6f7be674956c481acaa53ca791`. There is no functional CAS37 dependency and no CAS code or release metadata is imported. Main's release36, copy24 and143 code, every inherited migration and Edge Function, release manifests, historical manifests and the withdrawn2300 archive/registration retain their exact bytes. Audit140 is not duplicated. The11 frontend source/test payloads match the reviewed135 source exactly.

The baseline delta remains exactly eight chronology lines. The guard manifest retains both proforma suites and registers135 once. Fresh isolated PostgreSQL17.9 replay passes287 migrations, with the same one repository-designated data-only omission. All four ordinary suites and reapplication/idempotency checks pass. A full forward before/after schema snapshot differs by exactly the eight intended lines; every other object and permission is unchanged. The local database is stopped after verification.

The combined frontend passes29 tests in seven files, including copy24; changed-file ESLint and clean nonincremental app/node typechecks pass. Migration hygiene, schema functions, canonical replay mirrors, test hygiene, RPC synchronization and schema columns pass. The two pre-existing mirror fingerprints remain unchanged.

`audit:manifest` intentionally reports exactly233700 as unassigned: APP_VERSION, CHANGELOG and all release manifest bytes are unchanged. This is a code-review draft, not a release-ready envelope. A future coordinated release must add the new migration without rewriting history. The current inherited manifests cover34–36, and the35 archive is also retained unchanged; earlier history is neither restored nor rewritten. Coordinate unpublished migration timestamps with any separately delivered CAS candidate before applying SQL, but do not block independent functional review on CAS packaging.

No full frontend suite, live database, browser or remote CI success is claimed. The production build passes with a3072MB heap and sourcemaps disabled; existing chunk-size/dynamic-import warnings remain. The inherited CI bootstrap/schema snapshot differences are not copied wholesale into baseline. No merge, SQL application or deployment is authorized by this draft.

## CI follow-up: preserve the existing N31 fixture across time zones

The first exact-head CI run passed TypeScript, schema replay/baseline and 185 of 186 ordinary guards. The static DB stage stopped at the explicitly pending release manifest. Independently, `ola4_n31_n36_n37` failed because its synthetic advance omitted `fecha_anticipo`: the default used the UTC session's `CURRENT_DATE`, while its application used the Mexico business date. During the observed UTC midnight window these were 2026-10-07 and 2026-10-06, respectively. The new chronology rule correctly rejected that inconsistent fixture.

Only the fixture now supplies `fecha_anticipo = public.fecha_negocio_mx()`. No production function, default, migration, error code, permission or assertion is relaxed. The original fixture fails with the expected chronology error under UTC; the corrected full N31/N36/N37 suite passes under both UTC and America/Mexico_City, including the unchanged second-application rejection and final balance40 assertion. Fresh replay287, all four135 ordinary suites and idempotent reapplication also pass. The production SQL hash and eight-line baseline delta remain unchanged. Remote CI on the follow-up head must still be observed; the draft's missing release envelope is still intentional.
