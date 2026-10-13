# Demo cleanup tenant guard: disposable two-session CI candidate

Status: executable candidate; static checks only so far. No SQL/database/Docker execution is claimed. Requires the reviewed forward migration and canonical security mirror with SHA256 `59d7aa84e5cdcfe94d2e34ac5c8c78e0aa68d65e5168178836ba44a9dfe2c1fe`.

Function body SHA256: `7d139b609da7020fd178744dda6a48a13de331d21b6c29d0c31f6c39a255f3b7`; PostgreSQL `md5(prosrc)`: `49ad742438d1a94b22524bcb8cb06633`. The adapter validates source bytes and the graph query derived from those bytes; the clone checks exact live body, postgres owner, plpgsql, SECURITY DEFINER, search_path=public, row_security=off, and service-only EXECUTE privileges. It records checked-out source commit and original metadata.

## Run only in the existing isolated GitHub Actions PostgreSQL service

Integrate before `_ci_post_migrate.sql`, broad grants, FK drops, or any fixture suite. The optional workflow patch supplies these inputs:

- GITHUB_ACTIONS=true
- ISOLATED_QA_DB=1
- DEMO_GUARD_DISPOSABLE=1
- DEMO_GUARD_POSTGRES_SERVICE_ID: exact 64-hex job.services.postgres.id
- POSTGRES_IMAGE: the already reviewed pinned PostgreSQL image

Commands: `python3 scripts/ci/demo-guard/test_static.py -v`, then `python3 scripts/ci/demo-guard/run-actions.py`.

No standalone DSN or remote-host mode exists. Adapter inspects the existing service, uses its local Unix socket via docker exec, and creates two fresh random-name template clones sequentially. It never pulls/starts/installs a container or software. `postgres` is read-only/template source, never seeded. Every clone must be removed using generated-name provenance, recorded bigint OID and postgres owner; no FORCE or broad termination exists. Ambiguous CREATE is reconciled once using its prechecked-absent name, never retried. Wrong owner/OID fails closed and reports cleanup failure.

## Assertions per clone

1. Writer contention: A installs rollback-only fixtures, four pre-DML observers, and the core stub. B holds a catalog-verified RowExclusiveLock on untouched `anticipos_aplicaciones`. The real wrapper, called with actual service_role and service JWT, must return SQLSTATE 55P03 from the reviewed NOWAIT gate. Observer/core/tenant/FK errors and success fail the case. Full demo/non-demo fixture rows, seed state and zero core calls remain unchanged.
2. Gate retention: B owns a separate test advisory transaction lock. A calls the real wrapper and waits in its stub core. Observations require that exact advisory key/blocker and every ShareRowExclusiveLock in the source-derived recursive FK graph, including shared endpoints. On untouched `anticipos_aplicaciones`, B's ROW EXCLUSIVE NOWAIT and ACCESS EXCLUSIVE NOWAIT probes must both produce 55P03.
3. In the same second case, B actually attempts a demo-owned `anticipos_aplicaciones` INSERT referencing A's synthetic other-organization advance, invoice and payment. The driver observes B's ungranted RowExclusiveLock on that exact relation and A as blocker; B must then receive 55P03 from its bounded 3-second lock_timeout. This is a genuine INSERT command blocked before row/FK/trigger execution, not a separate LOCK substituted for INSERT.
4. B rolls back, releasing the test advisory barrier. A must return true, run the core once, advance seed state and preserve the other organization's complete captured rows. A's entire graph lock set must remain after RPC return and disappear only when A rolls back. Both sessions close on failure paths.
5. After each case, complete persistent public/auth table-row fingerprints and schema/function/constraint/trigger/policy metadata equal their pre-fixture values. Original core and observer changes are restored. Clones are finally dropped. Source public/auth data/schema/security fingerprints are compared before/after even on failure.

## Important interpretation limits

Only A/B are persistent business/test sessions; transient read-only catalog observers use additional connections. The INSERT creates a test-only wait cycle because A waits on B's advisory lock while B waits on A's graph lock. Both sessions set deadlock_timeout=30s, beyond their 20s statement_timeout; B's 3s lock_timeout resolves the cycle. A 40P01, statement cancellation, missing wait observation, or unexpected early completion fails. The driver uses bounded catalog polling, never guessed sleep ordering.

A's fixtures are never committed; B cannot see their FK parent rows. Thus this INSERT proves pre-row relation-lock exclusion with unsafe cross-tenant intent. It does not prove an eventual FK check would accept the row in B, a committed-edge freshness race, or the internal fingerprint-mismatch branch. Repeatable-read/serializable and unknown-edge behavior remain covered separately by the forward single-session suites. No arbitrary non-FK trigger safety claim is made.

No existing wrapper, FK, trigger, RLS policy, permission or application row is bypassed or weakened. Additive observer triggers and sole core replacement are transactional. The edge probe has no observer trigger and must have no preexisting RowExclusive/ShareRowExclusive/AccessExclusive lock in A before wrapper entry; setup pollution is a hard failure. Core business generation itself is stubbed, not exercised in full.

Catalog relation fingerprints exclude mutable vacuum/statistics counters; security/schema attributes remain covered.

Row fingerprints cover persistent public/auth ordinary tables (including ordinary partition children), not sequence counters. Sequence increments can survive rollback inside the disposable clone; the entire clone is dropped. Source sequences are not used by fixtures because source is never mutated. Fingerprints are a supplement to owned-clone isolation, not a backup/restore mechanism.

## Acceptance before integration/merge

Run the static suite, verify source and exact workflow preimage, then execute in disposable CI. Require two fresh-clone passes, both named cases per run, exact lock/error evidence, restored clone data/security, preserved source fingerprints, and verified absence of both clones. Run the existing forward single-session regression and full repository CI separately. Do not treat these static results as PostgreSQL runtime validation or authorization to run against an ERP/live project.
