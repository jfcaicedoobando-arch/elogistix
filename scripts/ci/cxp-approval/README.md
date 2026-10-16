# Isolated Contador approval concurrency regression

This runner implements three cases against the real reviewed RPC:

1. Creator double-click: two authenticated sessions for the creator, first commits; second must return `PT409 / LC_CONFLICTO_CONCURRENCIA:`.
2. Creator and another same-organization Contador: creator commits; second must return the same exact CAS conflict; only the creator's decision event survives.
3. Creator rolls back: the already-blocked distinct Contador succeeds with the original timestamp, without retry or token refresh; only the waiting actor's decision survives.

Each case requires an observed `pg_blocking_pids(waiter)` containing the precise holder PID, `active`/`Lock` activity and an unfinished waiter. Arbitrary sleep, timeout, deadlock, disconnection or other SQLSTATE never counts as success. SQL errors are captured in a SECURITY INVOKER temporary wrapper, then the losing outer transaction is explicitly rolled back. Business calls always run with `SET LOCAL ROLE authenticated`, checked subject, Contador role and membership. There are no public helper functions, ACL changes, disabled triggers or payment operations.

Fixtures reuse the corrected serial test's `pg_temp.cxp_fixture` unchanged. Synthetic auth identities and email inserts are mandatory. The SQL server's JSON timestamp text is passed back verbatim, without parsing into a lossy date type. Full concepts, payments, membership and role rows remain unchanged; the unrelated organization's invoice and audit rows remain unchanged. The winning invoice must equal the full returned RPC row and exactly one decision must contain the correct actor, email, organization, amount, currency and justification. No warning-driven missing audit is accepted.

## Supported execution and verification

`run-actions.py` is the sole supported entry point. The standalone database CLI was removed after independent review found its cleanup weaker than the Actions path. Directly executing `concurrency.py` now fails without opening a connection. It remains the imported session/assertion module for the verified Actions adapter; do not introduce another ad-hoc database lifecycle around it.

Python 3 standard library and the pinned Actions PostgreSQL service are sufficient. No package installation is added. `run-actions.py` records the actual checkout commit; the original reviewed context remains separately recorded as `1559f48d4818d0edfe98dc46cf4cbe69770d9f82`. The RPC's runtime `md5(prosrc)` must equal `c910bfde57c93d5e8a225d221cbe41b1`.

All invoice fields are frozen except this explicit approval-only allowlist: `estado_aprobacion`, `aprobada_por`, `aprobada_at`, `motivo_rechazo`, `aprobacion_heredada`, `justificacion_sin_vinculo`, and `updated_at`. The comparison includes every other existing or future column, not merely selected monetary fields. Matching returned/persisted rows cannot conceal an unintended IVA, IEPS, retention, currency, amount, date or payment-status change.

Revision 3 is prepared; its cleanup projection correction is **not runtime-tested yet**. In prior-revision Actions run 38465149137, all three first-clone races passed; cleanup safely refused the string-encoded OID, so the second clone and final source comparison were not reached. Python syntax and 34 assertion/isolation/refusal unit tests pass. These include financial changes copied into both the RPC result and persisted snapshot, added/deleted invoice columns, changed clone OID/owner, missing clone and ambiguous-CREATE reconciliation. They use Python data only and do not prove RPC, database teardown or concurrency correctness.

    python3 scripts/ci/cxp-approval/test_static.py -v

Before integration acceptance, execute the Actions adapter against the exact real postimage; it requires all three scenarios in each of two fresh clones. Preserve `actions-result.json`, each run's `result.json`, and SQL/session/cleanup logs. Optional row-lock-removal database mutant testing remains unperformed.

## Optional existing-job CI integration

`run-actions.py` is the CI entry point. Apply the separately delivered `optional-integration/rls-tests.patch` to the existing `rls-tests.yml`, after checking its recorded preimage blob. It preserves the job, service, original steps and pinned image. Both PR and main path filters include this directory. The blocking step runs after bootstrap/squash/migration replay and both ACL checks, immediately before `_ci_post_migrate.sql`. Therefore these cases use the real pre-relaxation schema rather than CI's later dropped auth FKs or broad grants.

The workflow provides `job.services.postgres.id`. The adapter accepts only an exact 64-hex container ID, verifies Docker's returned ID, running state and pinned image, and uses only the local Docker Unix socket with a clean environment. It never discovers a container by name, starts a container, pulls an image, uses a production secret or accepts a remote endpoint. It runs `psql` already present inside the verified service, through its private Unix socket, so no additional package installation is needed.

A control connection to `template1` creates a new unpredictable `cxp_approval_race_<uuid>` database directly from the now-idle prepared `postgres`. Synthetic writes occur only in that clone. The adapter runs all three cases, closes all sessions, verifies clone ownership/name/OID and drops it without FORCE; it repeats this lifecycle with a second fresh clone. It verifies clone absence after DROP and the source RPC metadata before/after. Uncertain CREATE outcomes are reconciled against the generated name and prechecked absence, never blindly retried. Failure or interruption executes the same cleanup. If ownership identity changed, it refuses deletion and fails. Actions owns and removes the service at job teardown if an unavoidable interruption prevents cleanup.

The adapter records the actual read-only `git rev-parse HEAD`, not a supplied claim, while `reviewed_baseline` separately identifies the original reviewed source context. Function-body hash remains fail-closed. Both clone runs must pass and both removals must verify before the step can pass. The next `if: always()` upload step retains `reports/cxp-approval-concurrency/`, including both run results and cleanup records. Missing/failed tests cannot silently skip into a passing step. The workflow ran for the prior revision, passing the first clone’s three races but failing cleanup before the second clone. Revision 3 changes only the cleanup OID projection to bigint and adds wire-type regressions; it still needs a complete Actions rerun.

## Revision 3 cleanup wire-type correction

Actual CI returned `{"rows": [{"oid": "31064", "owner": "postgres"}]}` while the separately captured OID was integer `31064`. PostgreSQL JSON serializes its native OID type as a string. The ownership guard correctly refused that incompatible type. The cleanup query now explicitly projects `oid::bigint`, producing the numeric wire contract the guard expects. The guard itself is unchanged: non-integer OIDs, changed OIDs and changed owners still refuse deletion. No broad cleanup, forced deletion or coercion of untrusted identity values was added.
