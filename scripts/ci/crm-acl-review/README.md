# CRM helper ACL isolated review

This is synthetic CI infrastructure for the new CRM ACL reconstruction. No historical test result or historical lost hash is reused. This package never applies SQL to Librecarga, invokes Lovable, changes a migration ledger, or deploys anything.

## Inputs and invocation

- `input-manifest.json` pins exact copied source/candidate/fixture bytes from source commit `70a55d4e29784fb1a78ed74f164473153bead704`.
- `inputs/proposed-owner-only.sql` contains an explicitly synthetic, non-executable placeholder binding. `adapter.bind_candidate` replaces only its `$contract$` JSON payload with `export_contract.sql` output from the disposable fixture. No production metadata or production contract is included. The private frozen candidate is preserved separately.
- `adapter.fixture_sql` expands the three fixed, hash-pinned migration includes for stdin. Roles are provisioned by the bootstrap administrator, and all fixture schema and candidate work execute as `postgres NOSUPERUSER`.
- Offline tests: `python3 -m unittest discover -s scripts/ci/crm-acl-review -p 'test_*.py' -v`. These do not start a database and are not integration evidence.
- Runtime: the draft-PR workflow only. `run_ci.py` rejects other event/repository/branch/base/head combinations and refuses execution outside GitHub Actions. It accepts no DSN, host, credentials, arbitrary image, existing container, or production mode.

## Isolation and ownership

Pinned image `postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`; runtime asserts server `170006`. Container network is `none`; no host bind mounts or exposed ports. Read-only root filesystem, ephemeral tmpfs, dropped capabilities, non-root OS user, no-new-privileges, CPU/memory/PID limits. PostgreSQL listens only on an owned Unix socket. Candidate role is neither superuser nor member of bootstrap administrator and lacks catalog write privileges.

SQL enters psql through stdin. Its stderr merges into stdout inside the container before Docker multiplexing. Owned persistent sessions are reaped before cleanup. Token/labels/container ID/image/isolation are checked before stopping/removing only this run's container. PASS can be emitted only after database shutdown and confirmed container removal.

## Coverage and limits

`cases.py` covers clean ACL convergence, replay, mixed state, authenticated DML, preservation of unrelated 0016 and 0018 objects, rejected function/ACL/trigger/relation drift, role inheritance/superuser postconditions, and transaction context. For null ACL, binary body, SQL body and return-type drift, an administrator deliberately corrupts catalogs in disposable clones only, to retain the original object identity; this is never candidate behavior. Each clone is destroyed.

`concurrency_cases.py` adds synchronized two-session conflict, revocation, trigger/event, interruption and race-regression tests. Actual activity/lock observations are required, and evidence records any test-only instrumentation. Instrumented SQL is never mislabeled as the exact production or fixture-bound candidate.

Snapshot preservation covers the named catalog sections in `snapshot.sql`. It excludes physical xmin/ctid and statistical/maintenance fields; it is not a proof over every PostgreSQL catalog or future dependency. Only target function ACLs and their PostgreSQL-managed shared ACL dependency entries are exempted from the positive semantic comparison. Negative tests require exact equality of all snapshotted metadata before and after rejection.

The cooperative advisory lock does not freeze all DDL. A new target-specific operational DDL window through postflight remains required for any future production consideration. Concurrent new trigger links on unrelated tables, comments and role changes are not globally prevented. A concurrent grant-option addition without dependent grants may be normalized rather than rejected; characterization does not certify strict rejection of every transient ACL state. A later authorized change after migration commit is outside this operation's preservation invariant.

## Evidence

The artifact records source/workflow commits, run URL, sanitized-template/fixture-bound SQL hashes, fixture hash, server version, named results, SQLSTATE, snapshots and lock traces, plus cleanup result. The workflow and harness itself are bound to the recorded checked-out commit. Any missing case, unexpected success, failed synchronization, timeout, metadata difference or unconfirmed cleanup fails the run. Integration status remains NOT RUN until the GitHub Actions result and its artifact are inspected.

## Public sanitization

The public export performs exactly two candidate transformations: replacing only the `$contract$` JSON payload with synthetic placeholders and remapping the cooperative advisory pair to the fixed synthetic keys `(817401,817402)`. The private candidate is unchanged. Candidate SQL outside those two normalized segments is byte-for-byte equivalent, with its normalized hash in `input-manifest.json`. The generator and concurrency competitor use the same synthetic advisory pair. Public evidence is entirely disposable-fixture data. A CI pass is not permission for a live operation.
