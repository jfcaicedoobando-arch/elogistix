# Frozen Pricing RPC bounded replay

This package executes only in a fresh GitHub Actions PostgreSQL 17 container.
It never connects to Supabase, Lovable, an existing database, or a fiscal service.
No database URL, password, token, uploaded document, CSF, or real row is an input.

## Exact proposed execution

Workflow: `.github/workflows/pricing-rpc-bounded.yml`.
Command: `bash scripts/ci/pricing-rpc-bounded/run-ci.sh`.
The runner rejects execution outside GitHub Actions. Publication and execution
are separate from preparing this package; preparing it proves no runtime pass.

Five SQL files reproduce the reviewed bounded schema/role bootstrap, auth helpers,
and candidate byte-for-byte. The assertion suite has two independently reviewed
syntax corrections at original lines 24 and 477: each adds the missing ARRAY
constructor keyword in a FOREACH expression. Relation lists, conditions, all 30
notices, rollback logic and ACL checks are unchanged. `provenance.json` records
the current six SQL hashes and the original/corrected assertion hashes. The first
CI attempt failed before C01 on this syntax; it is not a runtime pass.
`SHA256SUMS` covers every bundle input except itself;
both runner-side validation and container-side verification fail on mismatches.
Hashes detect unintended changes, not malicious changes to an entire reviewed PR.
Updating the freeze requires explicit code review of SQL and assertion changes.

## Isolation and evidence

- Uses the same official, digest-pinned PostgreSQL 17.9 image as repository RLS CI.
- No network, ports, application server, credentials, deployment, production writes,
  host database, Docker socket mount, or repository-wide mount in the container.
- Only this allowlisted bundle is mounted, read-only. Process runs as the image's
  unprivileged postgres OS user with all Linux capabilities dropped and no new
  privileges. It uses its own fresh cluster with a private Unix socket.
- All simulated SQL roles are NOLOGIN. postgres is NOSUPERUSER BYPASSRLS.
  New candidate/guard EXECUTE stays revoked for PUBLIC, anon, authenticated and
  service_role. Positive candidate checks run as the isolated SQL owner only.
- Synthetic fixture IDs use `10000000-0000-4000-8000-*`; emails use `.invalid`.
  All fixture lifecycle writes roll back; the assertion checks empty scoped tables.
- Setup failure, psql error, missing/reordered/duplicate notices, cleanup failure,
  or artifact absence fails CI. No continue-on-error, retries or success fallback.
- Evidence is copied before container deletion even after failure. Only logs,
  input hashes, version/image, the 30 assertion notices and disposal status are
  uploaded for 14 days. No cluster directory or original metadata export is uploaded.
- Forced runner termination may prevent traps; job-level artifact upload uses
  always(), and the disposable hosted runner provides the final isolation boundary.

## What a successful run establishes

Thirty ordered assertion notices cover 33 scoped relations, 694 original columns,
211 constraints, 207 indexes, 123 policies, 45 original triggers across 13 mutation
tables, 62 public functions, three auth helpers and 18 enum label lists. They also
check candidate/hash/ACL contracts, auth claim precedence, mixed-currency totals,
valid synthetic FK seed, tariff response, same-org seller reads, denied app EXECUTE,
owner-path denials/happy path/idempotence, immutable lineage, ordinary quote save,
send/snapshot/notification lifecycle, tariff replacement, and final rollback.

This is a bounded frozen replay, not an automatic test of future production drift
or every repository migration. Several frozen helper bodies are formatting-
reconciled rather than byte-identical to current captured production source;
the SQL assertions distinguish prepared source hashes from current metadata.

Concurrency, multi-session deadlocks/retries, full role/origin permutations,
positive prospect/lead and terminal acceptance/closing paths, HTTP/JWT signatures,
PostgREST/schema cache, browser behavior, new authenticated candidate EXECUTE,
full existing-RPC regression, deployment and production certification remain outside
this package. Historical reduced-fixture results are not carried forward.
