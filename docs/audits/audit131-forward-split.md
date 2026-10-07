# Audit131: cash refunds as an isolated forward change

Original local split record, dependent on audit135. The release39 composition and correction are recorded below; the original SQL hash is provenance, not the current release hash.

## Provenance and dependency

- Parent candidate: `0211458a7100af3ddab858618e3ecfd6ba75c013` (`split/audit135-forward-local`), based on main PR170 `19a5c07`.
- Source implementation: `9608719131c3a479f3a87bd0ebb58acf4365808e`.
- Branch: `split/audit131-cash-refund-local`.
- New migration: `20261006234200_audit131_devolucion_efectivo.sql`.
- SQL SHA-256: `245f15c0d14914d5b5ef402ec81461566487ebf10335df1898a4691610b2bfa1`.

At the original split commit, the SQL was byte-identical to the original unpublished131 migration, with a new forward filename after135. Its three optional historical columns remain NULL; there is no backfill, inferred cash classification or rewrite of old transaction facts. New refunds persist actual refund medium, civil date and reference.

The refund RPC changes from six arguments to seven with `p_medio DEFAULT 'Bancario'`. The obsolete six-argument overload is removed so default argument resolution stays unambiguous. Existing callers omitting medium retain bank behavior; the updated client sends `Efectivo` with a NULL account, even if an obsolete selection remains in form state. Cash creates no bank movement. A bank refund still requires an active same-currency account from the same company and creates its actual deposit.

The migration includes the refund RPC plus ledger, payment-detail and supplier-statement consumers, so all four see the same date/medium/reference. No134 currency reclassification,139 allocation,148 identity, P&L or70 aggregate change is included. Those later changes must retain this refund metadata.

## Forward release conditions

Use the target/history/body inspection and reviewed-plan procedure in [audit135-forward-split.md](audit135-forward-split.md). Both local migration timestamps are later than the coordinated proforma35 SQL, but remote histories remain unverified here.

Before applying131 through a separately authorized deployment mechanism, confirm the expected six-argument refund RPC and that the new columns/signature have not already been installed by another writer. This migration is a one-time schema/signature transition, not a command to rerun indiscriminately. An unexpected target shape blocks it; do not force through drift or edit migration history. Compare the current consumer bodies before replacing them.

The new seven-argument RPC retains the established authenticated/service_role audience and no anonymous/PUBLIC execution. Backend/schema-cache readiness must precede the updated UI, since an old server does not understand `p_medio`. The six-argument legacy call remains valid against the new defaulted signature; no competing overload is retained.

The original stacked candidate left135 and131 unassigned. The release39 composition below assigns only131 on already-merged main38 without weakening the manifest guard. No remote migration or deployment is performed by either preparation.

## Verification record

- 36 frontend tests passed across refund-form account selection, service contract and treasury advance detail; the new service cases cover cash clearing a stale bank account, legacy bank default and missing-bank rejection before RPC.
- Changed-file ESLint, migration hygiene, test hygiene, schema functions, replay mirrors, RPC sync and schema columns passed.
- Fresh isolated PostgreSQL 17.9 replay passed: 286 migrations, one repository-designated production-data migration skipped. Five ordinary suites passed and rolled back: chronology135, cash/bank refund131, application-day FX/cash/date guards, no duplicated bank charge, and payment reversal restoring the advance.
- The legitimate bank refund is deliberately invoked with six arguments, proving the existing defaulted call works without an obsolete overload.
- The four normalized baseline function definitions and new table columns/constraint exactly match the replay snapshot. All other baseline conventions and unrelated ACL are preserved. Only the replaced refund signature is updated in its existing grant statements.

The original135 candidate remains unchanged. No full isolated app typecheck, build, browser, remote CI or actual database validation is claimed yet.


## Release39 composition on main38

The isolated source is now composed on `731f7903e82782a81391489c19cf178ee6051b81`, with all inherited source, migrations and release history preserved. Release39 adds only234200 to the1482-file release38 inventory; the35–38 manifest entries remain unchanged. SQL2335/2337 and previous changelog entries keep their exact bytes. See [application plan39](audit131-release39-application-plan.md) for dependencies, target checks, signature transition and rollback limits. Release38 application remains separately authorized; its Git merge is not evidence that it ran.

Independent review identified one source defect: a new refund without a reference inherited the original payment reference in the ledger and detail. The negative regression reproduced it for an originally bank-funded advance returned in cash. Only those two consumer expressions change: a recorded new refund medium selects `referencia_devolucion`, preserving NULL; a legacy row still uses the previous fallback. The final SQL hash is `9948d576a5e80d0cff621d1a01b8954742f66bbac37d07c5641e373dd59fdef9`. The original `245f15c0...` remains traceable at the source commit and is not claimed as the final hash.

Tests now also cover the actual detail wrapper, catalog signature/defaults/ACL, nullable columns, historical-reference fallback, and a bank-funded advance returned in cash without changing its exact original bank charge or fabricating a refund reference. This correction does not alter the RPC body, its defaults, its permissions, the supplier-statement consumer or the original economic facts.

On the release39 composition, fresh PostgreSQL17.9 replay applies289 migrations with the same repository-designated data-only omission. The complete normalized snapshot equals the committed baseline; all187 ordinary guards and49 RLS suites pass. The audit131 suite also passes under UTC and America/Mexico_City. An independent disposable main38 database upgrades through the complete final234200 file and converges to the fresh39 snapshot before broad CI grants; owner/ACL/security attributes and effective audiences of all five relevant functions remain unchanged except the intended refund signature/defaults. A pre-existing historical refund keeps every prior field byte-equivalent in JSON and all three new columns NULL. Both databases are stopped afterward.

All61 focused frontend tests in10 files pass, including catalog coverage and architecture baselines. The two new LC errors have friendly messages and standard/PostgREST translation tests. Changed-file ESLint, migration hygiene, test hygiene, schema functions, replay mirrors, RPC synchronization, schema columns and release manifest checks pass. The only existing architecture size allowance remains the208-line date-picker helper. Full frontend-suite, browser, live-database and remote-CI certification are not implied by these local results.
