# Deterministic adversarial snapshot race (proposed, not executed)

Run only against a fresh fixture from fixture.sql and its exported fixture-bound contract on PostgreSQL 17.6. Never run this instrumentation against production or treat its hash as the production candidate hash. Preserve an unmodified generated candidate and hash both versions separately.

## F1: committed ALTER in the former validation/baseline gap

Use three connections to the same disposable database. The controller first takes a session barrier:

```sql
SELECT pg_advisory_lock(715610, 1);
```

Generate a test-only candidate by inserting the following immediately before the unique comment `-- Derive only from the validated snapshot, with no second pg_proc read.`. Do not edit the production generator or production candidate to expose a test hook.

```sql
-- TEST_ONLY_SNAPSHOT_BARRIER: must never appear in production payload.
PERFORM pg_catalog.pg_advisory_lock(715610, 1);
PERFORM pg_catalog.pg_advisory_unlock(715610, 1);
```

Launch that candidate in a migration connection with a unique application_name. Poll from controller until its PID is observed waiting on the exact advisory barrier (classid 715610, objid 1, objsubid 2, granted false), not merely until a fixed sleep elapses. On bounded synchronization timeout, fail the case and terminate/rollback the migration connection. Candidate statement_timeout remains 20 seconds.

```sql
SELECT l.pid
FROM pg_catalog.pg_locks l JOIN pg_catalog.pg_stat_activity a USING (pid)
WHERE a.application_name = 'crm_acl_snapshot_race'
  AND l.locktype = 'advisory' AND l.classid = 715610 AND l.objid = 1
  AND l.objsubid = 2 AND NOT l.granted;
```

After observing the barrier, commit concurrent DDL from the competing connection:

```sql
BEGIN;
ALTER FUNCTION public._crm_empresa_no_borrar_cliente() COST 101;
COMMIT;
```

Assert fixture expected COST differs from 101 before using this value. Release controller barrier:

```sql
SELECT pg_advisory_unlock(715610, 1);
```

Required result: migration fails with CRM_ACL_CONCURRENT_METADATA_DRIFT (P0001), and its transaction is rolled back. Both ACLs equal their original fixture ACLs; the independently committed COST remains 101. Compare complete non-ACL metadata to pre-race baseline plus exactly the externally committed COST edit. OIDs, bodies and trigger rows stay unchanged. The migration must not restore COST. Repeat with the second helper in an isolated fixture. The old implementation's recapture allowed this interleaving to succeed; the repaired snapshot and final immutable-contract checks must reject it.

## F1b: after first REVOKE, before second

Move the same test-only barrier immediately before the second REVOKE and alter the second helper. Expected failure is identical, specifically proving rollback of the already-completed first ACL change while retaining the concurrent second-helper COST. Do not attempt ALTER of the first helper while it is held by the migration; that is a separate lock-blocking case.

## F2: concurrent ACL normalization boundary

In a separate fixture, use the first barrier and commit:

```sql
GRANT EXECUTE ON FUNCTION public._crm_empresa_no_borrar_cliente()
  TO service_role WITH GRANT OPTION;
```

With no downstream grants, REVOKE may normalize this to owner-only and succeed. Record this as a known unsupported strict rejection guarantee, not a passing fail-closed concurrency test. The validated initial ACL and final ACL are constrained; an unexpected intermediate ACL cannot be reconstructed after REVOKE. A new enforced operational DDL/ACL window is required before any production consideration. Do not restore a competing committed ACL by issuing inverse DDL.

## Offline evidence

The offline suite checks single catalog capture, baseline derivation from that snapshot, fixed-contract validation after both REVOKEs, absence of test barriers in production SQL, and an explicit Python model reproducing the old false acceptance. These are structural/model tests only; none establish PostgreSQL runtime behavior.
