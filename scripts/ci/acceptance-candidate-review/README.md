# Canonical prospect acceptance: isolated candidate review

This package is a review harness, not approval to merge or deploy. It evolves the
baseline-only PR264 approach without changing that PR or claiming its 12-case
pass proved candidate behavior. The exact product candidate is independently
reviewed and hash-bound; no result is a SQL pass until this workflow executes.

Candidate binding: exact independently reviewed revision 3 ZIP, source and
reviewer hashes recorded in `review-contract.json`. Runtime evidence remains pending.

## Source and admission

- Repository: `jfcaicedoobando-arch/elogistix`.
- Only same-repository PRs from `fix/acceptance-canonical-prospect-20261012`
  targeting main at `b355e978bd2fa8adda3195218d32cc61bfbfcc98`.
- Exact PR head checkout, read-only workflow permissions, no persisted Git
  credential, secrets, push event, schedule, dispatch or pull_request_target.
- Full baseline replay is pinned to 1,528 source files at becc073. The b355
  change to Supabase types remains untouched; it is outside backend source scope.
- Every source is checked by Git blob/size; every reviewed product file by its
  review SHA256/size. Migration, canonical mirror and candidate copy must be
  identical. The new migration is NOT silently included in baseline replay:
  the archive contains only pinned historical migrations, then candidate.sql
  is applied separately after the original catalog is captured.
- A byte-preserving tar of exactly the copied source allowlist is included in
  the artifact so independent reviewers can recompute all source hashes.

## Two runtimes, distinct evidence

- PG17.9 is the gate and sole baseline producer. The exact image digest is the
  repository RLS workflow's fixed official PostgreSQL digest; server version
  must be 170009.
- PG17.6 is diagnostic. Its fixed official image digest was established by the
  independently reviewed PR264 run; server version must be 170006. It does not
  produce or validate a 17.9 baseline.
- Both run the same candidate, real RPCs, behavioral and two-session cases.
  Fail-fast is disabled so one runtime's failure cannot suppress the other.

## Database boundaries

All databases below are newly owned inside a single newly owned container for
each runtime. Runtime has network=none, no published ports/bind mounts/host
checkout/Docker socket, read-only root filesystem, postgres user, dropped
capabilities, no-new-privileges and resource limits. Database bytes are tmpfs.
No database URL or external credential is accepted. Commands and SQL travel over
stdin `docker exec`; loopback exists only inside that isolated container.

1. `acceptance_review`: strict full schema. Never receives
   `_ci_post_migrate.sql`, auth-FK deletion, blanket grants, disabled triggers,
   RLS bypass settings or substituted public business functions. Actual SQL role
   authenticated and synthetic JWT subject make every business RPC call.
2. `acceptance_baseline_base`: PG17.9-only clone of strict original schema,
   before candidate or business fixtures. It alone receives exact existing
   repository post-migrate compatibility preparation and normalizer. Its dump
   must reproduce the known base baseline Git blob exactly.
3. `acceptance_baseline_candidate`: PG17.9-only clone of strict candidate schema,
   still before business fixtures. The same compatibility preparation produces
   the candidate baseline. Only the reviewed acceptance CREATE FUNCTION block
   may differ from base. This clone's broadened grants/removed auth FKs never
   count as security evidence.
4. `acceptance_concurrency`: clone of strict candidate schema, with original
   FK/ACL and synthetic sentinel. Committed synthetic fixtures support the
   actual two-session tests. It is never used to generate baseline.

The strict catalog is checked after each compatibility clone and after
concurrency. Outputs record each source/destination/purpose. Teardown removes
only the exact owned container ID and then verifies Docker reports that exact
ID absent; logs and both outcomes are preserved. No wildcard cleanup or remote
fallback exists.

## What is checked

- Exact public function catalog delta: only acceptance `prosrc` changes. OID,
  owner, ACL, security mode, search_path and all other recorded attributes stay
  identical. Original conversion body remains hash-identical.
- Functions, triggers, constraints, logical relation attributes, RLS policies,
  column attributes, schema ACLs and relevant role attributes are captured.
  Physical table statistics and vacuum transaction horizons are deliberately
  excluded from equality; sequence
  counters are not assumed transactional. No password/credential fields are read.
- Existing revised SQL catalog guard runs against the real installed candidate.
- The 12 independently established neutral cases run again after candidate.
- Expanded semantic inventory runs with exact error SQLSTATE/domain checks,
  NULL-resistant assertions, all tenant-table snapshots on negative paths and
  whole-suite rollback checks. The full explicit inventory lives in the contract
  and coverage file; zero/missing/duplicate/reordered markers are failures.
- Eight two-session cases use actual authenticated sessions, real row locks and
  observed blocking PID and authenticated exact-row probe evidence. At most one
  transient lock observer is added to the two persistent business sessions;
  its exact PID/query is cancelled and rolled back after proving contention.
  Only the exact fixture lead is probed by its existing authenticated seller
  owner, with tenant/ownership checked through real RLS; both RPC actors remain
  the original manager. Other row probes use that manager. NOWAIT's explicit
  55P03/LC_COTIZACION_EN_PROCESO is followed by rollback/retry and final invariants;
  deadlocks, unrelated timeouts, transport failures and raw uniqueness failures
  cannot pass as intended business outcomes.
- Runtime platform network/queue stubs become explicit failures before strict
  business tests. No mocked-success business function exists.

The membership mirror creates current user_roles; tests do not insert a second
copy or use blocked legacy operador/admin/viewer roles. The ordinary test actor
is never super_admin. One focused global-admin tenant-scope negative is explicitly
marked in semantic coverage; it is not a positive business bypass.

## Baseline handoff is a gate

The PG17.9 baseline artifact is generated before the neutral, semantic or
concurrency fixtures. It is never edited into the checkout by this runner.
The first run is expected to report
`behavior_pass_baseline_artifact_requires_commit` and exit nonzero if behavior
passes but `supabase/schema/baseline.sql` still has the old bytes. Review the
candidate dump/diff and exact source association, then root writes the verified
artifact in a subsequent commit. Only a rerun with the exact checked-in baseline
matching the fresh generated dump can report `candidate_pg179_gate_pass`.

Normal repository RLS/guards and general CI still apply to the product PR; this
focused runner does not claim their results. A generated artifact is not a
published database change. No NC migration/envelope, production database, PAC,
payment, deploy or existing business record is modified.

## Commands

Local static checks only:

    python3 scripts/ci/acceptance-candidate-review/run.py --static-only
    python3 scripts/ci/acceptance-candidate-review/test_runner.py
    python3 scripts/ci/acceptance-candidate-review/test_lock_probe.py

Gated Actions only:

    python3 scripts/ci/acceptance-candidate-review/run.py --postgres 17.9
    python3 scripts/ci/acceptance-candidate-review/run.py --postgres 17.6

No local SQL execution or software installation was performed while preparing
this package. Read the final run.json, each case artifact, baseline diff, raw
catalog/row snapshots and teardown logs before interpreting a CI result.
