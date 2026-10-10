# CRM concepts-only synchronization candidate

## Verified scope

The frozen PostgreSQL 17.9 replay on PR #220, head
`d1e94d2d45195e21a55b4d40970a8f0275d4a2af`, failed L04 with quotation subtotal
300.00, opportunity amount 251.00 and preserved Pricing lineage. The live
read-only catalog on 2026-10-10 also has the missing `conceptos_venta` watch
column (PostgreSQL 17.6). No live record was changed in preparing this patch.

The normal wizard payload includes `conceptos_venta`, `subtotal` and `moneda`.
The demonstrated defect is therefore a concepts-only server update consistency
gap, not a demonstrated normal browser save failure. PostgreSQL decides an
`UPDATE OF` trigger from the original SET list; a BEFORE trigger changing
subtotal does not add subtotal to that list. See the official
[PostgreSQL 17 CREATE TRIGGER notes](https://www.postgresql.org/docs/17/sql-createtrigger.html).

## Minimal behavior change

`supabase/migrations/20261010004500_fix_crm_quote_concepts_sync.sql` adds only
`conceptos_venta` to the existing CRM trigger's watch columns. INSERT behavior,
AFTER timing, row scope, no WHEN predicate, trigger function, existing four
columns and trigger name are retained. The function still ignores opportunities
that are deleted, closed or from a different organization, and still avoids
rewriting an already matching opportunity. Its existing zero/empty-concepts
semantics are not changed.

The transaction takes a bounded table DDL lock, requires the exact original
enabled trigger and reviewed CRM body/security mode, and checks the complete
trigger catalog row except the intentional column-list delta. Function catalog
rows, table ownership/ACL/RLS and trigger comments must stay unchanged or the
transaction fails. No row is backfilled, and no function, grant, policy, owner
or application activation is changed. The migration intentionally rejects an
already-patched or drifted trigger instead of silently skipping it.

## Separate regression overlay

The builder does not edit `pricing-rpc-bounded/replay.sql`, `assertions.sql`,
their provenance, hashes or original notice contract. It requires exact hashes
for both original SQL files. Example preparation, with output outside that bundle:

    python3 scripts/ci/pricing-crm-trigger/build-overlay.py \
      --bundle scripts/ci/pricing-rpc-bounded --output /tmp/crm-trigger-overlay

Generated baseline assertions insert only the independent wizard-shaped SQL
test before L04. That test changes concepts/subtotal/currency to 340 and checks
CRM synchronization; its savepoint then restores both 251 amounts and the prior
role before the untouched L04 update runs. Generated candidate assertions add
the same check, update only the C07 catalog expectation for the one intentional
trigger-column difference, and add a repeated-concepts check after L04 that
requires 300 and no physical rewrite of the aligned CRM opportunity.

The complete original L04 UPDATE, both 300 predicates, error and diagnostic
DETAIL remain byte-identical in both generated files. All other original
catalog, security, lineage, lifecycle, rollback and ACL assertions are retained.
The wizard-shaped check tests SQL payload behavior, not HTTP/JWT or browser UI.

## Required CI contract before claiming success

Run only under the existing approved disposable, no-network, private PostgreSQL
17 container restrictions. This directory does not relax that runner or start a
database. Integration and independent review must happen before execution.

1. Verify both frozen inputs and all candidate file hashes. Record the exact
   commit, image digest and PostgreSQL version. Never reinterpret a missing
   notice or unexpected error as an expected baseline failure.
2. In a fresh private database/cluster, load the unchanged bootstrap/auth/replay
   and retain the existing application EXECUTE revocations. Run the generated
   baseline assertions with ON_ERROR_STOP. Require exactly the 27 ordered
   baseline notices, exit 3, and the unchanged L04 diagnostic values:
   subtotal 300, opportunity 251, lineage true, both expectations 300. This arm
   must fail at L04; success, an earlier failure or a different failure is wrong.
3. Dispose that cluster. In a separate fresh private database/cluster load the
   same unchanged replay and revoke contract. Apply the exact migration in its
   own transaction BEFORE fixture DML, then run generated candidate assertions.
   Require all 32 ordered candidate notices, no SQL error, unchanged final ACL
   checks and Z01 proving all fixture rows/side effects rolled back. Migration
   success alone is not a behavioral pass.
4. Preserve both logs, migration log and hash/notice manifests even on failure.
   Require verified cluster and container/anonymous-volume disposal on both
   arms, and successful artifact upload. Never reuse an aborted SQL session or
   continue in the baseline transaction after its expected error.

Recommended extra CI guard tests, each in its own disposable fixture cluster:
missing/disabled/reordered-or-expanded target trigger, changed CRM function body
and a repeated migration must all be rejected without an unexpected change.
Do not mutate any remote catalog to exercise these tests.

## Remaining limits and risk

Runtime execution of this candidate is pending. Static generation is not a SQL
pass. No production deployment, database application, RPC activation, broad
migration replay, real financial operation or browser validation is included.
There is no historical repair of existing stale amounts. The change adds an
existing guarded CRM synchronization attempt to concepts-only writes; those
writes may now encounter the same opportunity locks or guards as subtotal or
currency writes. Lock timeout and transaction rollback avoid an indefinite
migration lock; application concurrency/performance remains outside this test.
