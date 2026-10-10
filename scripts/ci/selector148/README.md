# Selector148: targeted CI wiring

This directory belongs to the existing `RLS tests result` job. It adds no workflow,
production activation, migration registration, release identity, database credential,
UI change, or permission expansion.

## Integration prerequisites

1. Base the child on the accepted financial/exact-coverage/insurance-restore parent.
   Financial49 owns `20261009010000_audit148_cobertura_documental_exacta.sql`,
   `20261009010100_audit148_papelera_seguros.sql` and its focused envelope harness.
2. Register exactly one later atomic selector migration from the approved **disabled**
   installer. `contract.json` separately pins its reviewed source and registered
   envelope. The only registration change is one exact `audit:allow-no-grants`
   comment immediately before the selector's CREATE header. This uses the existing
   H6 private-function exception without adding an EXECUTE grant. Verification
   requires the complete registered hash, removes only that exact single marker,
   then requires the original reviewed-source hash. No executable bytes change.
   Do not split installation, all-six validation, enforcement check, function
   creation or ACL. The hook refuses missing/duplicate/different bytes.
3. Keep the release UI feature gate false. This CI patch does not apply the earlier
   local UI patch, which has the gate true for synthetic testing only.
4. Reconcile the migration/release/type manifest and generated schema inventory in
   the child. Require `CI Success` and `RLS tests result` for its exact remote head.
   The pinned PostgreSQL 17.9 schema artifact is captured **before fixtures**. An
   initial baseline mismatch can require a narrowly reviewed artifact refresh and
   another Actions run; it must not be treated as a passing test run.

## Execution and isolation

- CI uses its existing `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` and
  `psql`. There are no absolute workstation paths, separate server or custom port.
- `rls-prepare-db.sh` captures one pre-selector template at the exact verified
  installer boundary. Capture and cleanup require explicit Actions/isolation flags,
  loopback port 5432, the expected postgres account/database and no URL/service
  overrides. Every database is named for the workflow run/attempt and is marked
  with a run-specific database comment. Creation uses `template1`, avoiding a live
  connection to the source template.
- The runner uses only captured/created names. It never tests or enables the main
  `postgres` database. Cleanup verifies both marker and owner before removing any
  named clone, and records absence afterward. Actions service teardown is the final
  boundary if the job itself is forcibly terminated.
- The only JavaScript dependency is an independently locked `pg` alias matching
  the reviewed local proof's `@supabase/pg` 8.21.1. `npm ci` runs in this directory,
  skips lifecycle scripts and optional dependencies, and does not install the
  frontend. Node 20+ and npm are provided by the ubuntu-24.04 runner.
- Enabled variants are derived from the registered disabled body, changing only
  its literal and the authenticated grant. Enable-only variants retain the exact
  all-six structural precondition. Disabled state is restored and checked before
  clone teardown. No production tenant trigger, role or policy is changed.

## Coverage inventory

- Main rollback manifest: unchanged financial guards, the verbatim 64-assertion
  restore successor, and one disabled selector ACL/literal guard. The two Audit54
  `test_rls_*` manifest entries are removed because automatic RLS discovery already
  executes them. Starting reference: 213 manifest entries -> 212; 50 RLS suites.
- Serial: exact triple parity and integrated security/pagination on two install
  lineages in both UTC and America/Mexico_City, with exact expected notices and
  full before/after catalog/data comparisons. Includes the five approved business
  roles, membership disagreement, active organization, hidden same-tenant
  denominator, result/cursor/date behavior and all-six FK prevention.
- Serial: 65 structural enable/runtime rejection cases, six historical foreign-key
  anomalies plus NaN, atomic late failure after grant, exact additive collision and
  guarded enablement idempotency. Failed mutations must restore their snapshots.
- Serial: six two-writer races, exact persistent parent-tenant FK rejection and
  controlled cancellation/statement timeout with the generic selector error.
- Serial: 10,001 committed candidate rows in 41 batches under the normal 64-lock
  setting. Rejects partial/empty-success output; the assertion preserves all data.
- The serial runner checks the existing restore guard log for all 64 notices and
  the four exact rejected-INSERT/state-preservation labels. It does not rerun it.

Security/parity tests and all DDL/committed tests are absent from the parallel
manifest. No `test_rls_*` suite is registered twice. The selector is never added
to the service-role-only catalog. Its migration ACL is checked before CI's broad
GRANT and restored afterward, with disabled/enabled state preserved.

## Evidence and honest status

`.selector148-logs` contains process statuses, assertion results, ownership,
compressed catalog/data snapshots and cleanup proof. The workflow uploads it on
success or failure. Existing failure artifacts additionally include the exact
`schema.actual.sql` and financial49 logs.

Preparation checks are syntax, frozen-source parity, dependency-lock closure,
workflow parsing, discovery and patch roundtrip only. No local PostgreSQL replay,
UI matrix, full suite or typecheck is needed to prepare this patch. GitHub Actions
must establish runtime results; historical local evidence is not remote CI status.

## Runtime profiling (CI plan, phase 3)

The existing evidence artifact now includes `profile.json` from the serial runner
and `replay-profile.jsonl` from the original replay. No additional job, database,
query, parallel execution, credential, checkpoint or cache is introduced.

`profile.json` records wall time, parent-process CPU time, sampled RSS and counts,
totals, minima/maxima and thrown-operation failures for these operations:

- the same nine serial snapshot queries, JSON parsing and received JSON bytes;
- fixture reads, JSON serialization, SHA-256, gzip level 1 and evidence writes;
- owned database cloning/closing, SQL subprocesses and the concurrency subprocess.

The query timing combines server work, transfer and driver overhead; it is not a
server-only SQL execution time. The byte count is decoded JSON text, not protocol
traffic. Parent CPU excludes PostgreSQL/child-process CPU, and sampled RSS is not
continuous peak RSS. Nested operation durations overlap: do not sum all metrics
into wall time. No SQL text, fixture values, credentials or environment dump is
included in the profiler. Existing full evidence remains unchanged and recoverable.
Metrics never determine the functional result: a sensor or profiler-file failure
emits one fixed warning and disables only telemetry. A surviving Node report has
`profiling_complete: false` and null overall measurements; its metric entries are
partial. A replay JSONL without a complete `total` row is incomplete. Do not treat
either as a valid benchmark. Failures writing required snapshots, hashes or other
functional evidence still fail normally, and original SQL/errors/exit codes remain.

Replay uses Bash wall-clock microsecond timestamps, without a new process per
phase. It records bootstrap, squash, ordered individual migrations, dispatch and
each enabled pre-forward checkpoint. A `total` row retains the original exit code;
the failing phase also retains it. Backwards clock changes are marked invalid.
These phase times are disjoint except `total`, which must not be added to them.
Safety checks still run before replay/profile initialization. Existing workflow
`always()` cleanup and artifact upload remain required, including on failures.

Run `npm test --prefix scripts/ci/selector148` after installing its locked dependency
to check metrics, byte-identical gzip/manifest evidence, serial query order, notice
validation and failure propagation. The tests do not contact PostgreSQL. Full
installer, mutation, ACL, rollback and concurrency proof still runs only through
the guarded CI harness; profiling does not replace any of it.

An initial local experiment removed the outer `jsonb_pretty` presentation wrapper
while retaining all fields/order. Across 12 alternating samples per mode on the
same disposable PostgreSQL 17.9 lineage, serialized JSON and gzip were identical
and received JSON shrank from 10,353,792 to 7,800,730 bytes. However, median snapshot
time changed from 1.077 s to 1.208 s under shared-machine contention. This is not an
Actions benchmark or reproducible speedup; the compact candidate was rejected and
is not included. Production SQL, transport and snapshots keep the original format.
Use comparable Actions runs and the new metrics before choosing an optimization.
