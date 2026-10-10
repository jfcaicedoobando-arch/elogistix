# Isolated CRM trigger baseline/candidate CI

This is a test-only integration of the independently reviewed CRM trigger patch.
`candidate-migration.sql` is a CI fixture. It is deliberately outside
`supabase/migrations`, release metadata, deployment paths and live database tools.
The original author explanation is preserved in `CANDIDATE-README.md`; its
migration path describes the proposed forward fix, not an installed migration.

## Immutable inputs

Every file in `../pricing-rpc-bounded` is byte-for-byte frozen at PR #220 head
`d1e94d2d45195e21a55b4d40970a8f0275d4a2af`, including the original scripts,
provenance, notice contract and `SHA256SUMS`. `frozen-SHA256SUMS` additionally
pins all fourteen files. The original workflow is replaced to run this separate
contract; the frozen bundle itself is not changed or run directly.

Reviewed migration SHA-256:
`25548288f0ca87b0cd458de65a0a5aa1ababd09e6be2e7f25763bf75540a1c74`.
Reviewed overlay builder SHA-256:
`d3154291e5041dcac8fbf197380486518a9f640b3f294a9fb52fed23eb8d54ce`.
`SHA256SUMS` covers every separate candidate/runner file except itself.
`overlay-contract.json` pins all five deterministic overlay outputs; the builder
cannot silently change the SQL or notice contract. Host and container hash checks
are retained in evidence. The unchanged source load/revoke SQL and final ACL SQL
are extracted into separate files and checked literally against the frozen runner.

## Required outcomes

1. Baseline: a fresh private PostgreSQL 17 cluster loads the unchanged synthetic
   bootstrap/auth/replay and application EXECUTE revocations. It executes the
   baseline overlay with ON_ERROR_STOP in a separate session. It MUST produce
   exactly 27 ordered notices, psql and container exit 3, the original L04 error,
   and exactly the expected JSON diagnostic: quotation subtotal 300, opportunity
   amount 251, preserved Pricing lineage and both expectations 300. Baseline
   success, an earlier/different/extra error or an incomplete diagnostic is red.
2. Baseline cluster/container and any image-created anonymous volume are disposed
   and verified absent before the candidate is created. No aborted session or
   cluster is reused.
3. Candidate: another fresh private cluster loads the same frozen inputs and
   revocations. The exact candidate fixture runs in its own BEGIN/COMMIT before
   any assertion fixture DML. Its log must show COMMIT. The candidate overlay must
   return exit 0 and all 32 ordered notices, including unchanged L04, repeated-save
   R01, lifecycle checks and Z01 proving all rows/side effects rolled back.
   The literal original final ACL checks run successfully in a fresh session.
4. The candidate cluster/container/anonymous volume must also be disposed and
   verified absent. Both arms must match the pinned image and PostgreSQL version.
   The GitHub job is complete only if artifact upload also succeeds.

A failed assertion/migration still preserves its log. Both arms are attempted
when baseline execution fails unexpectedly but disposal succeeds; the aggregate
verifier keeps the job red. A disposal or evidence-copy failure stops before
another arm is created. The wrapper never converts an arbitrary exit 3 to green.

## Isolation and execution

Only GitHub Actions can invoke `bash scripts/ci/pricing-crm-trigger/run-ci.sh`.
The workflow has pull-request/path-filter and manual triggers only, read-only
contents permission and nonpersisted checkout credentials. No deployment trigger,
production connection option, secret or arbitrary SQL input is accepted.

Both arms use the existing repository-pinned official image:
`postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae`.
Containers use network none, the unprivileged postgres OS user, all capabilities
dropped, no-new-privileges and bounded CPU/memory/PIDs. Only the frozen bundle,
separate CI candidate directory and generated overlays are mounted read-only.
Generated synthetic overlay files are explicitly mode 0644 under a 0755 directory
so the container user can read them despite the host evidence umask 077.
The checkout and Docker socket are never mounted. An image-created anonymous
PostgreSQL volume is unused and removed with its owned container; no existing
volume is selected. All database processes receive a clean environment, use a
private Unix socket and listen on no TCP address. Simulated application roles
remain NOLOGIN and candidate application EXECUTE remains revoked.

Container inspection verifies these settings before starting SQL. Cleanup stops
only its owned cluster and removes only its owned temporary directory/container.
It never prunes Docker resources or deletes any named/foreign volume. Docker
container/volume list checks must succeed and confirm absence, rather than
interpreting an arbitrary inspect failure as proof of disposal. SIGINT/SIGTERM
run cleanup; uncatchable termination can prevent evidence collection, with the
GitHub disposable runner as the final boundary. Do not report such a run as pass.

## Evidence and local checks

`pricing-crm-trigger-evidence/` holds exact checkout commit/image, frozen/candidate
hash manifests, deterministic overlays, both SQL logs, migration output,
PostgreSQL client/server versions, checked Docker isolation/state, disposal results and the
aggregate summary. The workflow first tees orchestration-preflight stdout/stderr
into `pricing-crm-preflight.log`, outside the runtime evidence directory, with
explicit pipefail. It uploads that log plus the runtime directory even on failure
for 14 days, including when preflight fails before runtime creates its directory. It does not upload PGDATA or credentials. Artifact upload is a required
job step; a local aggregate summary alone does not establish upload success.

Run without a database or Docker:

    python3 -B scripts/ci/pricing-crm-trigger/verify-inputs.py
    python3 -B scripts/ci/pricing-crm-trigger/tests.py
    python3 -B scripts/ci/pricing-crm-trigger/test-orchestration.py

The tests use synthetic evidence for expected outcomes and negative cases:
missing/duplicate/reordered notices, baseline success, wrong exit/error/JSON,
extra diagnostics, candidate failure, incomplete migration, final ACL failure,
hash drift, wrong image/version, unsafe Docker settings/mounts, missing evidence
and failed cluster/container/anonymous-volume disposal. They also validate shell
and Python syntax, frozen byte identity, unchanged L04 and workflow scope.
The orchestration test also runs the actual host shell wrapper against a fake
Docker executable for seven success/failure paths, checking sequential disposal
and migration-log retention. No real container process is launched.
These checks are static/mocked only; they do not constitute a SQL runtime pass.

## Limits

This validates a bounded, frozen catalog and synthetic SQL behavior. It is not
browser/HTTP/JWT, concurrency/load, full-migration or production validation, and
it does not activate RPC access or repair historical stale amounts. The normal
wizard-shaped SQL payload is independently exercised in both arms; the demonstrated
regression is the concepts-only server update. Migration guard-rejection scenarios
(missing/disabled/changed trigger, changed function, repeated migration) remain
recommended extra isolated SQL tests and are not claimed as runtime-covered here.
