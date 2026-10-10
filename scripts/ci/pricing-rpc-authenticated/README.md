# Isolated authenticated Pricing RPC and compatibility CI

This additive CI-only layer extends the reviewed PR #220 candidate while leaving
`../pricing-rpc-bounded`, `../pricing-crm-trigger`, and their existing workflow
unchanged. It does not install a production migration, expose an endpoint, create
credentials or enable lasting application access.

## Immutable provenance

The bounded bundle remains byte-frozen at
`d1e94d2d45195e21a55b4d40970a8f0275d4a2af`. The approved paired runner is pinned to
PR head `1f67a47e2ba6d95475a2ebf513ecbd0e8d65a4e2`, merged in
`820a2a99c799cb4f3136a0b4b9f3ddf794cd3638`.

`frozen-SHA256SUMS` pins all fourteen bounded files. `reviewed-SHA256SUMS` pins
all nineteen original paired-runner files, including its own hash manifest.
`verify-inputs.py` checks both original directories without altering them. This
layer copies the original trigger migration, wizard/repeated-save snippets,
load/revoke and final ACL SQL byte-for-byte; the input verifier enforces that
identity. `reviewed-build-overlay.py` is the exact original builder, independently
pinned to SHA-256 `d3154291e5041dcac8fbf197380486518a9f640b3f294a9fb52fed23eb8d54ce`.

The new builder first derives the reviewed 27/32 paired overlays in a temporary
local directory. It preserves baseline SQL/notices exactly and inserts the new
candidate-only snippets before original L03. All original candidate assertions,
including the L04 diagnostic, remain literal; only the scope header changes to
truthfully describe temporary grants. The generated-output hashes are pinned in
`overlay-contract.json`; the full separate package is pinned in `SHA256SUMS`.

## Required runtime outcome

- Baseline: exactly 27 original ordered notices, followed only by the expected
  L04 failure and exact 300-versus-251 JSON diagnostic, with psql/container exit 3.
- Candidate: exactly 53 ordered notices, psql/container exit 0,
  original Z01 rollback proof last, and the unchanged final ACL check passing in
  a separate session.
- Both arms must use distinct private clusters/containers. Their cluster,
  container and image-created anonymous volume disposal must be verified. The
  baseline must be disposed before the candidate starts. Artifact upload is
  required separately; a mock report or local summary does not prove SQL ran.

The count is original 32 plus 18 authenticated notices and 3 compatibility
notices. The verifier rejects an old 32- or 50-notice candidate contract, missing,
duplicate, unexpected or reordered notices, arbitrary baseline errors, failed
migration, failed ACL restoration and incomplete disposal.

## Added coverage

`authenticated-entry.sql` tests sixteen real SQL-role contexts: five permitted
link/retry contexts and eleven denials. These cover seller ownership, broad staff
and commercial/admin access, quote writers lacking CRM-update permission,
viewer/client/agent boundaries, missing identity, foreign/revoked membership and
super-admin selected/missing/wrong tenant. In particular customer_service and
ejecutivo_pricing remain unable to update opportunities; this does not widen
their current permissions.

`compatibility-smokes.sql` adds three bounded groups: the existing authenticated
prospect RPC with NULL Pricing lineage; accepted/closed customer quote historical
retry and soft-delete preservation; and fresh-link rejection for five soft-deleted
origin boundaries. It does not add an exhaustive lead/state matrix.

All fixture identities use synthetic UUIDs and `.invalid` emails. The snippets
require the exact pre-L03 state and the isolated bootstrap identity. Only the
new candidate RPC receives temporary EXECUTE for the synthetic authenticated
role, bounded by rollback-only savepoints inside the already disposable fixture
transaction. Anon/service_role and the guard function never receive new access.
Role switching is checked around actual calls. Guarded exception subtransactions
undo each scenario; outer savepoints undo temporary grants. Restoration checks
precede the original assertions. An uncaught error aborts the session/transaction
under ON_ERROR_STOP, so no failing test can commit the grant.

No table/schema grant, policy change, role creation/alteration, disabled trigger,
new credential, token, HTTP service or external database connection is involved.
This proves SQL role/claim behavior only when actual runtime logs pass. It does
not validate signed JWTs, PostgREST routing/schema cache, browser integration,
production drift or multi-session concurrency.

## Isolation and execution

Only the new `pricing-rpc-authenticated.yml` workflow invokes this layer. It has
pull-request/path and manual triggers, read-only contents permission, no saved
checkout credentials, no deployment environment and no secret references. The
workflow first captures mocked orchestration preflight output with pipefail,
then runs the actual isolated wrapper, and uploads preflight/runtime evidence
even on failure.

The wrapper uses the same pinned official PostgreSQL 17 image, network none,
unprivileged postgres OS user, all capabilities dropped, no-new-privileges,
bounded resources and three read-only mounts. It mounts only the frozen bundle,
this separate candidate directory and generated overlays, never the checkout,
Docker socket, credentials or a host database. PostgreSQL listens on no TCP
address, uses an owned private Unix socket, and receives a clean environment.
Simulated platform/application roles are NOLOGIN. The only persistent commit in
the candidate cluster installs the already reviewed CI-only trigger fixture;
all test rows and transient RPC grants roll back before disposal.

`run-arm.sh` and the host verifier retain the original load, migration, failure,
evidence-copy and cleanup behavior. No broad prune or foreign volume deletion
is used. Any failure to collect evidence or dispose resources stays red.

## Portable preflight tests

No local parser package or absolute workspace path is required in CI. Everything
outside the pinned PostgreSQL container uses Python's standard library and Bash.
Run without Docker or PostgreSQL:

    python3 -B scripts/ci/pricing-rpc-authenticated/verify-inputs.py
    python3 -B scripts/ci/pricing-rpc-authenticated/tests.py
    python3 -B scripts/ci/pricing-rpc-authenticated/test-orchestration.py

The tests use synthetic notices/evidence and a fake Docker executable. They
exercise strict output counts and order, source/hash preservation, literal
baseline identity, temporary-grant scope, grant-restoration notices, shell/Python
syntax, no local preparation dependency, missing/altered evidence, unsafe
container configuration, baseline success/wrong error, candidate/migration
failure, and failed copy/disposal. They are static/mocked tests, never SQL passes.

## Remaining activation boundaries

Passing this workflow would close the prepared authenticated-role and bounded
compatibility gaps. A supported isolated PostgREST/JWT smoke, full-trigger
multi-session lock schedules and final UI/rollout catalog verification remain.
The new RPC and production trigger fix still require the appropriate separate
rollout/activation steps; a CI-only merge does not perform them.
