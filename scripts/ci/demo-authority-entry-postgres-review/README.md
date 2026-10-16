# Authority provider + issuer entry: isolated PostgreSQL integration

**NOT_ADMITTED. Endpoint DISABLED. Operational wire UNBOUND.** This lane composes
PR362's protected registry/SQL17–18 with PR361's original authority provider and
issuer entry, on merged main `6674a1b9b80982ba7bc9f566ab5f7473bfe7d0a3`.
It does not alter either implementation, the issuer algorithm, owner/store,
historical golden runners, their gates, or their source pins.

## What executes

The exact `authority-provider.mjs`, `issuer-entry.mjs`, `createIssuer`, `ISSUE_SQL`,
mapper and dedicated driver are imported at their original relative paths.
Twenty-nine inputs are pinned by byte length, SHA256 and Git blob SHA1.
SQL16, producer, receipt/identity bridge and other original SQL dependencies are
installed as separate **unmodified, hash-verified files**. Original \ir includes
(runtime-guards.sql and crm-trigger.sql) are pinned and staged beside their
parent SQL, then psql -f preserves their relative resolution. SQL17/18 and the original
store are installed afterward. All table data, principals and catalogs are
synthetic and exist only in this runner's fresh owned database.

The original golden `lab_wire.mjs` is reused unchanged: pg **8.23.1**, Node
**24.19.0**, one private Client and Unix socket, observed CommandComplete and
ReadyForQuery, terminal write barrier, no pool/reconnect/replay. Its original npm
lock/SRI, six audited pg source blobs and Node archive SHA256 remain fixed.
The complete staged archive and every extracted file are checked before use.

The new orchestrator has its own exact draft/repository/base/head/opt-in gate.
It imports the golden runner classes without calling their historical entry
points. No historical gate or manifest is changed. The old staging intake has
an exact historical owner-directory inventory that predates the provider files;
this lane uses its own complete explicit source inventory. The original A
setup guard names a different database prefix, so this lane performs its own
fresh catalog/version/non-superuser preflight and then installs the unchanged
SQL dependencies individually. It does not rewrite or bypass that setup file.
The golden runtime file is retained in the archive for provenance and existing
archive validation; only `authority-runtime.mjs` is executed. The synthetic
business function from the earlier golden test is **never installed**.

## Eleven runtime cases

1. Empty configuration opens zero transports.
2. Authentic authority read, derivation, INSERT/history read and acknowledged
   COMMIT use one socket/backend/transaction with READ COMMITTED. An independent
   observer reads the backend transaction ID after the authority read. A
   fixture-only AFTER INSERT audit trigger records the same backend/transaction,
   isolation and synchronous_commit. The row is invisible to the observer before
   COMMIT and visible afterward.
3. Repeating issuance returns identical_record_only; the immutable row stays
   unchanged, INSERT returns zero rows, and no claim or business executes.
4. A deliberately seeded, coherent conflicting binding is a conflict without
   COMMIT; the protected source and existing ledger row are unchanged.
5. A deliberately seeded obligation-ID mismatch is a conflict without COMMIT.
   Both negative fixtures use the authentic issuer for the initial derivation
   and original INSERT; no substitute digest algorithm is introduced.
6. Revoked authority rejects before issuance and terminally quarantines the
   same entry instance, including later requests with another context.
7. Naturally expired authority does the same; no source timestamp is rewritten.
8. Closing after successful INSERT but before the history read rolls back both
   the issuance and its transactional observation row. The test waits for the
   entry backend to disappear from pg_stat_activity before checking absence.
9. Deterministic destruction at COMMIT CommandComplete before accepting
   ReadyForQuery leaves an independently observable committed row but returns
   quarantine. The entry never rereads it or opens another wire.
10. A real PostgreSQL lock wait is cancelled using pg_cancel_backend on the
    same synthetic owner's owned backend. SQLSTATE 57014 terminally seals the
    socket/entry, with no second wire or issuance row.
11. A second native session's revocation waits on the authority row until the
    entry commits; a later entry rejects the revoked authority. The independent
    observer records the actual blocker PID and lock wait.

Every success response is checked for executionPermission=false. The claims
ledger stays empty and the business entrypoint remains absent. All opened
transports must confirm closure. Final PASS also requires reaped Node/psql
clients, PostgreSQL stopped/no PID, and removal of the uniquely owned container.

## Isolation and limits

The golden PostgreSQL **17.6** image digest is unchanged. Container network none,
no exposed ports/host mounts, read-only root, non-root OS user, no capabilities,
resource limits and exact tmpfs options are checked. Only the owned tmpfs is
executable for the pinned Node binary. Candidate SQL role is NOSUPERUSER,
NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOINHERIT. Bootstrap roles exist only in
this disposable cluster. There is no DSN, external connection mode, operational
credential, migration application, grant on a real database or deployment.

This establishes native isolated integration and transactional visibility only.
It establishes **no RPC authentication, operational ACL, production admission,
business/financial behavior, crash/WAL/failover/restore durability, or persistent
cross-process quarantine**. The golden fsync-off/tmpfs configuration is not a
storage durability test. The ACK cut is deterministic, not a claim covering
arbitrary network failures. The entry's latch remains process-local.

## Verification and evidence

Offline, without any database or network:

```sh
python3 -B scripts/ci/demo-authority-entry-postgres-review/run_ci.py
python3 -B -m unittest discover -s scripts/ci/demo-authority-entry-postgres-review -p 'test_*.py' -v
node --test scripts/ci/demo-authority-entry-review/test_*.mjs
node --test scripts/ci/demo-wire-lab/lab_wire.test.mjs
```

The dedicated draft workflow is the only execution route. It runs against the
exact PR head on the fixed reviewed main base. Artifacts upload only sanitized
public JSON: status, runtime cases, protocol timeline and runtime/source hashes.
Staging binaries, dependency tree, ownership token and raw SQL/Docker/error logs
remain private. A failed case or incomplete cleanup cannot become final PASS.

Initial local verification: 13 Python gates/composition tests, 28 unchanged entry
Node tests pass. The unchanged golden wire tests have 19 PASS and three local
IPC cases blocked by this environment’s listen EPERM; CI runs all 22 intact.
PostgreSQL integration is **NOT_RUN locally**; inspect the exact workflow-head artifact for runtime results.

### Initial failed attempt retained

HEAD `3e07c44f4319620a6dcd7f548795ffa000d26507`, run 38837462496:
offline steps passed, but PostgreSQL installation failed at synthetic-schema
before any entry runtime case. The original \ir dependencies were missing from
the first staging composition. The correction pins and stages both unchanged
include files and executes the original source with psql -f. No guard/trigger
was removed or rewritten. This failed run remains FAIL, not runtime evidence.
