# Financial runtime preparation: HOLD, SQL NOT_RUN

This folder prepares an isolated Actions PG17.6 lane. No PostgreSQL, Docker,
real database, Git mutation, deployment, registry activation or credentials were used.

## Runnable narrow suite

`run_ci.py` is adapted from the independently reviewed authentic-producer runner.
`python3 -I run_ci.py` only verifies hashes and prints NOT_RUN. Future execution:
`GITHUB_ACTIONS=true DEMO_ACCEPTANCE_ISOLATED=1 python3 -I run_ci.py --execute-disposable --output /tmp/new-financial-evidence`
Only use that command in an explicitly authorized disposable Actions runner.
It creates an owned, network-none container with no bind mounts or published ports,
uses the pinned postgres digest and checks server_version_num=170006, bootstrap
supabase_admin separately, and tests as postgres NOSUPERUSER NOBYPASSRLS NOINHERIT.
Readiness requires PID 1 postgres AND pg_isready, excluding the temporary initdb server. This precondition wait never retries bootstrap or candidate DML.
Cleanup checks container and anonymous volume removal before any partial result.
The proposed workflow is restricted to the same-repository draft branch fix/demo-human-approval-review-20261015, checks out its exact event HEAD, uses read-only permissions and no secrets, and calls this runner from docs/review. Publishing it enables only this isolated review lane, never business functionality.

The runnable suite contains 24 scenarios against the exact human_approval_main body
SHA256 d1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0.
The approval validator, role hierarchy, has_role, rejection unlinker, currency helpers,
threshold helper and direct-approval guard use exact canonical function definitions.
No approval function is replaced by a success stub. Contador approving their own
invoice is expected to SUCCEED, as in pinned main70a55d4, not the stale source57 test.

Coverage: four approved roles including own-invoice Contador; another creator;
super_admin outside membership; four denied roles; unauthenticated/foreign tenant;
null and stale CAS; already decided; no concepts; mismatched subtotal; implausible
VAT; canceled/foreign shipment; unverified UUID; reject without reason; rejection
unlink of linked-cost concept and incoming-document fixture; direct approval forbidden. Each expected rejection checks exact SQLSTATE and
message prefix, and unchanged row snapshots. Successful calls require invoice actor,
state, timestamp and actual audit row. Every scenario deliberately rolls back its own
subtransaction and verifies all fixture rows unchanged; outer DDL also rolls back.
Identity-sequence gaps are deliberately excluded from row-snapshot equivalence.

IMPORTANT: auth.uid reads an explicitly SYNTHETIC fixture table. Tests run as the
NOSU database fixture owner; application roles are data in user_roles. This proves
helper branching only, not real human authentication, SQL-role ACLs, Supabase RLS,
JWT, privileged-role inheritance in deployment, or external identity issuance.
Only the canonical direct-approval trigger is installed; cancellation adjustment reversal triggers are not installed or tested. This is a reduced schema,
not an ERP migration replay or complete financial-trigger acceptance. No real
identities, RFCs, credentials or business documents are present.

## Prepared financial-engine extension (not registered in runner)

`prepared/happy_path.sql` and `prepared/checkpoint_rollback.sql` require an integrated
fresh issued run. They DO NOT create fake authorizations, replace the engine or
manually insert receipts. Current stage: NOT_RUN / integration BLOCKED.
Happy path invokes the real execute_and_checkpoint, checks 13 paired actions,
3 current approvals, 1 simulated payment, checkpoint/marker/receipt/projection
agreement, stable replay, deferred issuance checks, then rolls back.
Failure injection supports checkpoint, marker, execution_receipt, event and receipt.
It first asserts genuine issuance and a fresh run, proves the exact injected error
was reached, then compares every row in business/writer/identity schemas. A missing
function or unrelated error FAILS rather than passing as an expected rollback.
These scripts do not test COMMIT/ACK uncertainty or durable physical-connection lease.

## Exact integration gaps

The authentic runtime catalog has id-only invoice/concept/payment tables. It cannot
install or run the financial engine. Its existing supplier/shipment/category rows
must be extended before issuing snapshots, without changing identity catalogs.

1. Supply the complete column/default/FK/enum closure for engine tables enumerated
   in evidence/engine-dependencies.json. At least invoice financial/approval/date
   fields, concept tax/quantity/org fields, payment conversion/simulation fields,
   notes-credit/application/bank-link lookup tables and demo_seed_state are absent.
2. The baseline inventory finds 85 canonical trigger declarations on those tables.
   Integrate their exact function/constraint/dependency closure and forward changes
   through pinned main. In particular concept revision timestamps, payment amount
   conversion and approval/date/tax/period/balance checks cannot be stubbed out.
   The synthetic human schema is NOT a substitute for this engine catalog.
3. Reconcile writer 01-private installer requirements: owner authority currently
   requires rolsuper OR rolbypassrls, incompatible with the NOSU/NOBYPASSRLS case
   identity. Separate isolated bootstrap from execution and review installation;
   do not grant real roles extra privileges or remove this guard to pass.
4. Wire existing authentic producer/origin/registry to issuer, bridge and protected
   identity receipts, then real engine/atomic entry/helper. Current authentic lane
   intentionally does not provide the full financial writer catalog or fresh run.
   Do not reproduce its authoritative functions or insert synthetic authority.
5. Only after those gates, register engine tests in runner with fresh DB per case,
   pre/post manual two-tenant sentinels, verified NOSU roles, and final input hashes.
6. Still separate: true app-role ACL/RLS, external human authentication,
   multisession races, real transaction commit/ACK recovery, durable dispatch and
   production compatibility. None is certified here.

## Offline validation

`python3 -I offline_checks.py` verifies package hashes, exact helper body, canonical
extraction hashes, cases and nonexecuting runner guards. It never launches SQL or
Docker. Offline PASS does not mean SQL parses or behavioral scenarios PASS.
`evidence/status.json` keeps runtime, engine, identity and deployment NOT_RUN/BLOCKED.

Source baseline blob returned by GitHub at 70a55d4e29784fb1a78ed74f164473153bead704
matched local cached baseline bytes exactly: 0d45d45881096808d8dcf1ca3831559d8759f477.
Only enumerated function/enum definitions were extracted; historical seed bodies
were never copied into this package or executed. Canonical validator was separately
read at that same commit. Hashes establish reproducibility, not authorization.
