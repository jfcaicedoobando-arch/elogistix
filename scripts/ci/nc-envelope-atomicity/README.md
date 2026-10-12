# PostgreSQL 17.6 NC envelope atomicity review

Tests only. The migration already merged in supabase/migrations/20261012010000_nc_publica_paridad_replay.sql is read and hash-checked, never edited. The envelope is the exact prepared one, SHA256 7de71cd79af07fa9cf39a98007040ebb496563262fae3351e18f62f40df54c2b. Embedded migration SHA256 is 14ac2ab9e561771d2adf10be0b5bf0701b97d91a5955844787301e77f7456825.

## Admission and isolation

Only same-repository pull requests from test/nc-envelope-atomicity-pg176-20261012 into main. No push, schedule, pull_request_target or manual event. Both workflow and runner check repository, branch, PR event and exact head SHA. Checkout is pinned and does not persist credentials; workflow permissions are contents:read. No project credentials, secrets or remote database parameters are used.

Python runs on the hosted Actions runner. It pulls the official postgres:17.6-bookworm image, resolves its postgres@sha256 digest, creates exactly one owned container from that digest and verifies server_version_num=170006. Runtime identity and digest are recorded, so tag movement cannot silently change the tested PostgreSQL version. The container has no network, published ports, bind mounts, host checkout, Docker socket, privileges or capabilities. Its root filesystem is read-only, postgres is the runtime user, and the new cluster lives solely in its /tmp tmpfs. SQL is delivered by docker exec over stdin to psql inside that container, not through a network connection. PostgreSQL listens on loopback inside the container only.

The fixture is schema-only: empty invoice/NC/payment table shapes, enum, migration ledger and the three reviewed final-state function definitions. It contains no business rows or secrets. Missing function dependencies inside the stored PL/pgSQL balance body are intentionally not exercised: this suite proves catalog preservation, envelope atomicity and ledger behavior, not financial arithmetic. Earlier isolated replay proves the financial matrix separately.

## Ten required cases

1. Exact envelope succeeds, preserves full pg_proc for all three helpers and stores one exact SQL element in the ledger. Timeout settings restore in the same session.
2. Duplicate registry application fails without changing state.
3. Invalid envelope hash fails before DDL or ledger writes.
4. Forced error after DDL rolls back a synthetic table/data probe and leaves catalog/ledger intact.
5. Forced error after ledger insert rolls back the ledger plus synthetic table/data probe.
6. A failing envelope restores timeout settings in the same reused session.
7. An inherited transaction_timeout longer than60s is refused and preserved.
8. Existing ledger lock causes immediate NOWAIT failure, then state is checked.
9. Synthetic lock contention after ledger insert triggers the envelope's exact5s lock_timeout and rolls back the ledger.
10. Synthetic pg_sleep after ledger/probe writes triggers the exact60s transaction_timeout, terminates the session and leaves no partial effects.

Failure variants inject only outside the embedded migration. Every injected case verifies the embedded source remains byte-identical. Nothing changes the reviewed migration, its ACL or its function bodies. Setup/reset/lock probes exist only inside the disposable owned container. Background lock-holder termination filters exact test application names inside that container. Cleanup removes only the exact container ID returned by this run, on normal success or error/interruption.

## Evidence and stopping condition

reports/nc-envelope-atomicity contains run.json with head/source hashes/image digest/isolation/runtime, ten distinct case results, durations, copied exact envelope/migration/fixture, per-query exact SQL/stdout/stderr, catalog-before/after, exact successful ledger, final empty ledger, container/PostgreSQL logs and cleanup confirmation. Artifact upload always runs and fails when no evidence exists. A pass requires all ten expected names in order plus confirmed container removal; any missing case or unexpected error fails.

The suite is a proposed harness until an actual workflow completes. Python syntax/static checks are not SQL execution. This PR does not change existing CI requirements/shard counts, apply hosted SQL, deploy, install software on user machines or authorize production testing. A green run validates the envelope on PostgreSQL17.6; future live execution still needs exact preflight, approved scope, single-statement submission and readback. Do not retry an uncertain live response.
