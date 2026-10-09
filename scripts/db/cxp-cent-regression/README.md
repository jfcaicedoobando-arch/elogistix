# Local CxP cent regression

Executed 2026-10-09 at approximately 17:28 UTC on native PostgreSQL 17.9.
Identical 65-assertion matrix: baseline 37 pass / 28 fail; candidate 65 pass / 0 fail.
Exact fingerprints are in `tested-hashes.json`. Results: `results.csv`, `compare.log`.
No remote SQL, browser, or production data was used.

## Reproduce

Run `scripts/db/cxp-cent-regression/run.sh` from an ordinary OS user with PostgreSQL 17 installed. Optional variables: `PG_BIN` (directory containing initdb/pg_ctl), `PSQL_BIN` (psql executable), `PG_LIB` (shared-library directory), `PGPORT` (default 55458), `REPO_ROOT`, `OUT_DIR`.
The script starts an isolated trust-authenticated PostgreSQL bound only to 127.0.0.1:${PGPORT},
loads the minimum schema and dependencies, runs live baseline and candidate functions,
exports assertions, checks that candidate has zero failures and baseline demonstrates
at least one defect, then stops PostgreSQL. It creates and deletes a new temporary cluster, never connects to an existing database. Test output remains in OUT_DIR (a new temporary directory by default).
The script rejects an existing process on the chosen port through PostgreSQL startup failure and does not fall back to another server.
The first successful run loaded setup then compare in two separate invocations; the
reproduction wrapper combines those identical phases. Subsequent script edits only
make role/schema setup and fresh initdb repeatable; business functions and matrix were
not changed or rerun after the recorded execution.

## Real code under test

- Complete live `_recalc_estado_proveedor_factura` and `validar_cierre_embarque`,
  then complete candidate versions, loaded without replacing their financial logic.
- Exact live `v_proveedor_facturas_saldo` and both currency-conversion functions,
  read by the parent at 17:26 UTC. `dependencies-executable.sql` only adds missing SQL
  statement terminators between pg_get_functiondef copies; function/view bodies are unchanged.
- Real PostgreSQL relational rows, SUMs, numeric arithmetic, filtering, currency
  conversion, allocation attribution and persistence updates.
- CxP assertions select the `cxp_pagada` check from the full validator JSON. They do
  not substitute a locally calculated expected balance into the business function.

## Explicit isolation and limits

This is a functional regression fixture, not full-schema application integration.

- `auth.uid`, `auth.role`, `current_user_org_id`, `has_role` return fixed fixture
  identity/service-role values. Tenant filters inside the CxP query execute, but
  RLS, grants, auth membership, security boundaries, and hostile cross-tenant data
  are not validated by this suite.
- `resolver_sin_comision` returns true, avoiding unrelated commission dependencies.
- `pnl_financiero_embarque` returns fixed 20 profit/100 sales. It executes AFTER
  the CxP check and affects only `margen_minimo` and global `puede_cerrar`. Tests
  assert the specific CxP check, never claim overall readiness validation; this
  stub cannot turn the CxP rule's false into true or vice versa.
- CxC tables remain empty. `saldo_factura` is a table-derived fixture implementation,
  and CxC conversion/REP helpers are copied from the historical repository baseline.
  None supplies values to the CxP calculation. No CxC regression result is claimed.
- Minimum schema intentionally omits app triggers, constraint/permission complexity,
  payment RPCs and concurrent transactions. The normalized payment column is seeded
  through the live currency conversion function (or supplied frozen advance amount).
  Reversals change fixture application rows, then call the real recalc explicitly.
  This validates recalc semantics, not automatic trigger wiring or reversal RPCs.
- Advance rows and their associated payment are present. The actual live view and
  conversion function prove the advance is counted once; it is not added again.
- No migration-installation/ACL/guard-hash/idempotence claim is made by the 65 tests.
- Borrador state remains Borrador, while its linked positive debt blocks the CxP
  rule; Cancelada is excluded. This is recorded explicitly, not hidden as a general
  assertion about whether drafts belong in closure.
- Historical paid invoice with real coverage and 0.01 residual remains paid. No
  batch historical rewrite/backfill is performed. Frontend explicit-Pagada override
  compatibility is a separate TypeScript responsibility.

## Matrix

MXN/USD whole unpaid cent; exact payment; full reversal and capture rollback;
100/99.99 and 0.02/0.01 residual compatibility; NC full coverage, draft and soft-delete;
advance exact application and reversal; signed payment cancellation; negative net
coverage; payments+NC net zero; another paid invoice and MXN overpayment cannot mask
USD debt; accumulated residuals >0.01 remain blocked; allocation factor 0.1 cannot
hide the entire unpaid debt; FX exact payment and credit; missing FX blocks; Cancelada,
Borrador; NULL total; absent view row; unknown invoice; zero total; covered historical
paid residual. See `matrix.sql` for all inputs and `results.csv` for all 130 outcomes.

## Migration transaction verification

The complete migration was separately executed locally with exact live owner/ACL/security-definer/search-path metadata. It preserved every public fixture table row, both function OIDs and all metadata. Reapplication was rejected by the reviewed-source precondition, and explicit ACL drift was rejected by metadata precondition; both transactions rolled back without data/function changes. The portable script additionally runs this transaction test and verifies both expected error markers. Migration SHA256: 475dd768e0388bf6b3d07f09c435b2b17b246ffd8b73d69eaa25ae89becdbadf. This does not prove full-production-schema compatibility or concurrent behavior.

## Packaging validation

The portable wrapper was syntax-checked and its SQL file references reviewed; it
was not reexecuted after packaging because the business-function fingerprints and
65-case matrix were unchanged. Executed evidence comes from the local harness and
separate complete-migration transaction test described above. It uses explicit
127.0.0.1 host and hostaddr, explicit port/user/database, clears inherited libpq
service/options/credential variables, and starts its own newly initialized cluster
before any psql call. No connector or remote database endpoint is present.
