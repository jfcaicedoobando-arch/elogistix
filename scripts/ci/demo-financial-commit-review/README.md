# Actual COMMIT review, synthetic only

This separate draft lane measures actual PostgreSQL COMMIT and visibility from a
new native psql connection. It does not reuse the earlier outer-ROLLBACK PASS as
COMMIT evidence. Original author fix `a7aff9ff8f92852687c56d3bc05d41150b44b2ae`
and all 30 historical files remain byte-identical. The explicitly reviewed PR354
base is `616bff8d454f9de35b6590913d08b7ad0d69b049`; its additional immutable reviewer
packages and adapter do not change the SUT, baseline or golden infrastructure.

## Three fresh disposable clusters

| Case | Actual transaction and expected evidence |
| --- | --- |
| original_invoker | Preserve historical INVOKER descriptor. Real COMMIT under service_role is expected to fail 42501 in authorize_issuance_deferred calling closed assert_issued. A fresh read-only observer must see the exact pre-business snapshot and canonical unresolved classification. This is an expected rejection, not a successful business COMMIT. |
| proposed_definer | Change only authorize_issuance_deferred() SECURITY DEFINER in the owned disposable cluster. Business COMMIT must return; a fresh read-only observer reconciles complete, all 13 events/receipts, 3 approvals and 1 simulated payment. A fresh connection retries the same context with a second actual COMMIT. A second fresh observer must see identical full, foreign-tenant and global snapshots. |
| proposed_revoked | Apply that same descriptor proposal, legally revoke exactly one bound run as the lab owner, restore service_role, then attempt actual COMMIT without draining constraints. Expect 42501 DEMO_RUN_UNAUTHORIZED and an independent exact baseline/rollback observation. |

The positive case requires five different backend PIDs: setup, business, observer,
retry, observer. Metadata lives in a separate owner-only synthetic schema, excluded
from business snapshots. Observers use REPEATABLE READ READ ONLY, have no original
TEMP context and use the canonical readonly reconciliation/verification functions.
The two manual sentinel rows, every foreign-tenant public table, global catalogs
and synthetic auth rows are compared without filtering away empty tables.

## Original guard and separate proposal

`sql/deferred-owner-context.sql` contains one ALTER FUNCTION descriptor statement.
It neither rewrites the historical source nor changes its body, owner, ACL or
search_path. Before/after snapshots preserve complete pg_proc metadata except the
body (hashed separately), complete pg_trigger and its pg_constraint. The only
permitted delta is `authorize_issuance_deferred.prosecdef: false -> true`.
Both other deferred authorization triggers remain bound to their exact original
SECURITY DEFINER function; all three stay enabled, DEFERRABLE INITIALLY DEFERRED.
Effective EXECUTE for every fixture app role and all non-owner ACL grantees must
remain closed. A final snapshot must equal the selected pre-business catalog.

No SET CONSTRAINTS IMMEDIATE, flush helper, early RESET ROLE, procedure transaction
wrapper or synthetic success marker substitutes for the actual COMMIT. The revoked
negative briefly selects the fixture owner to revoke one run, records native
revocation evidence, and restores the real technical role before COMMIT.

## Isolation and acceptance

`run_ci.py` refuses local SQL/Docker and all events except the exact same-repository
draft branch/base/head. It reuses the unchanged golden `crm-acl-review/run_ci.py`
SHA256 `a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816`
and image `postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`.
There are no network, ports, host mounts or DSN. The candidate is NOSUPERUSER,
BYPASSRLS, NOINHERIT and has no admin membership/role/database creation rights.
All grants and synthetic roles exist only inside each owned ephemeral cluster.
Each case requires its exact stage sequence, native exits, markers, input hashes
and verified PostgreSQL shutdown/client closure/container removal.

The historical installer catalog, separate same-context retry proposal and explicit
three-expediente synthetic manifest variant are verified through their original
helpers/pins. No canonical baseline or previous lane is modified.

PASS only covers synthetic committed rows with the separate descriptor proposal
and its negative controls. PostgreSQL runs in tmpfs with fsync off: crash/WAL
durability, sequence rollback, real issuer/identity, real runtime ACL/RLS and HTTP
driver/socket continuity remain NOT_RUN or NOT_ESTABLISHED. Wire UNBOUND,
configuration EMPTY and demo DISABLED. No production connection or deployment.

Preparation ledger: `f53f0be281d2085cd18f0de97987e40ea68c3b01` added the original
observer/source contracts; `58b0c7f5b536bdc474e5f731c6f1fda506e4287e` added exact
author pins and the controlled revocation probe. Runtime outcomes must reference
their own workflow head and artifact; preparation alone is NOT_RUN.
