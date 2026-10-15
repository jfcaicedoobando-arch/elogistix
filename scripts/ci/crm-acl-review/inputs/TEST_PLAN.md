# New CRM ACL proposal: required PostgreSQL 17.6 acceptance

This is a new reconstruction. Historical SQL SHA 82768f4e345704b43573b2a1ede2dfa67dbbdf924a249a90ed0c015c0e75152a and the reported historical 59+7 tests are not evidence for these bytes. No database tests have been run by this reconstruction worker.

## Fixture contract
Run fixture.sql only in a new disposable database named crm_acl_fixture_*. The fixture has no customer records, credentials, organization from production, or network dependency. It replays source 0016, 0017, 0018 fetched from repository ref 70a55d4. Export fixture contract with psql -At -f export_contract.sql, then build_sql.py contract.json candidate.sql. Fixture-generated OIDs are expected to differ from production; this is an explicit test binding, not a change to production OID guards. Do not regenerate production baseline automatically.

## Required cases, each isolated/recreated
1. Clean two-entry ACL -> exact postgres-only on both helpers; body, every other pg_proc attribute, OID, trigger links, comments, dependencies unchanged.
2. Replay owner-only succeeds, no semantic changes; mixed owner-only/excess ACL converges.
3. 0016 helper retains service_role EXECUTE; 0018 columns and all unrelated schema stay unchanged.
4. Synthetic authenticated DML: non-client soft delete allowed; OLD.cliente_id non-null blocks soft/hard deletion with 23514; OLD.estado_crm='Cliente' blocks soft/hard deletion with 23514; ordinary updates and non-client hard deletion still work. Direct trigger-function SELECT is not a valid execution test.
5. Missing function; renamed function; dropped/recreated OID; signature change; wrong owner; SECURITY DEFINER; COST; volatility; strictness; parallel; config; body; binary/sqlbody; return type drift must reject before persistent change.
6. PUBLIC/anon/authenticated grant, unknown grantee, grant option, NULL/default ACL, empty ACL, missing owner entry, unexpected grantor must reject with complete transaction rollback.
7. Missing/disabled/renamed trigger, changed tgtype/tgattr/WHEN/function, extra trigger link, table replacement/partition/inheritance must reject. No trigger recreation allowed.
8. Inherited EXECUTE via role membership or superuser service_role must cause postcondition rejection, restoring pre-transaction ACL.
9. Competing cooperative migration advisory lock rejects immediately; held conflicting table DDL lock rejects via NOWAIT; ordinary RowExclusive DML remains compatible; no partial ACL.
10. Hold first function ALTER/GRANT transaction, then start migration, commit competing body/cost/ACL update: migration must error or detect postcondition drift, never silently overwrite it. Repeat for second function, including after first REVOKE has executed; prove first ACL rollback on second failure.
11. Migration holds after first/second REVOKE: competing ALTER/REPLACE/OWNER/GRANT/REVOKE/DROP must wait/error; record pg_locks and synchronize with actual lock observation, not sleeps alone. Release migration and check ordering and final state. A transaction deliberately making a new authorized change after migration commit is outside the migration invariant.
12. Concurrent trigger change on crm_empresas is blocked; extra trigger on a different table requires dedicated adversarial testing. Do not claim broad dependency exclusion from an advisory lock.
13. Event-trigger-induced mutation of body/metadata during REVOKE must roll back; event-trigger exception on second REVOKE must roll back both ACL changes.
14. Interrupted client/statement timeout/lock timeout and connection loss before COMMIT roll back. Wrong current_user and non-READ-COMMITTED isolation reject.
15. Full diff of database metadata before/after shows only intended pg_proc.proacl and PostgreSQL-managed ACL shared dependencies changed. Physical xmin/ctid may change due to DDL and replay and are not semantic preservation claims.

## Evidence
Record exact PostgreSQL version, source commit, candidate and fixture SHA256, workflow commit/run URL, named results, SQLSTATE, before/after metadata and lock traces. Sanitize to synthetic-only metadata. Tests and independent review must be for the exact final candidate bytes. Do not report a static check as an integration pass.

## Known concurrency boundary pending review
SHARE UPDATE EXCLUSIVE relation lock protects crm_empresas existing trigger links while remaining compatible with ordinary RowExclusive DML. CREATE/enable/disable trigger require ShareRowExclusive; DROP trigger requires AccessExclusive. REVOKE updates serialize conflicting changes to each function tuple. It does not supply a permanent DDL freeze or globally lock all possible future dependent objects, comments, role memberships, or new trigger links on unrelated tables. Before production use, independent review must decide whether this bounded guarantee satisfies the requested fail-closed contract; otherwise establish a separately authorized maintenance/drain protocol or revise the design. No pg_proc table LOCK or direct catalog DML is used.

Before production apply, a new target-specific operational DDL window must cover the two helpers and relevant trigger links through postflight. An earlier R3 freeze is not valid authorization or evidence for this window. The invariant is preservation through this operation, not immunity to later authorized owner changes.

## Snapshot race regression
See SNAPSHOT_RACE_TEST.md for deterministic F1/F1b barriers, exact error/rollback assertions and the separate unresolved F2 intermediate-ACL limitation. These cases are proposed and have not been executed here. Production payload must contain no test hook.
