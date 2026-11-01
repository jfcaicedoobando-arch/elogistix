# Protected authority provider and issuer entry: draft B

Status: **NOT_ADMITTED**. This is a review-only implementation proposal, not an operational connection or activation. Its
unchanged source dependencies are pinned to `ecc53750c5d920d898ca2b00a2f717371dc19cf5`;
publication also preserves the subsequent unrelated main commit
`3a7c71fba35c9e7af509a8217a193929da21db9c`.

## Dependency and boundary

Draft A supplies `demo_flow_writer.read_authority(uuid)` in SQL17/18. Its contract
is `SELECT demo_flow_writer.read_authority($1::uuid) AS authority`: one protected
context reference and one JSONB projection matching the unchanged PR358 mapper.
The deployment comes only from trusted configuration. No caller occurrence,
manifest identity, skip, snapshots, claims or authentication boolean is accepted.

The SQL reader must authenticate the actual owner session through the existing
catalogue owner check and validate the original registry/preparation/receipt/
context chain. The `sessionPrincipal` projection describes the registry-approved
delegated principal; it is not evidence that an RPC transport logged in. Its locks must protect the restore fence, occurrence, binding and
all policy/source rows until the issuance transaction ends. Those are SQL17/18
requirements, not properties established by these JavaScript tests.

Draft B is not runnable against a database without separately reviewed draft A,
the owner ledger, its isolated writer permissions and an authenticated dedicated
wire. An injected fake wire can invent perfectly coherent authority. Passing the
mapper, checking source hashes or setting evidence labels is not authentication.

## Issuance transaction

1. Validate exactly `{contextId}` and require complete trusted configuration.
2. Open one dedicated physical wire using the unchanged driver contract.
3. BEGIN, explicitly select READ COMMITTED, enable local synchronous commit and
   read the protected authority while
   retaining all SQL locks.
4. Use the unchanged `createIssuer` canonical algorithm and unchanged `ISSUE_SQL`
   in that same transaction. No alternate hash or occurrence construction exists.
5. Read the exact natural-key, context and obligation-ID collision domains with
   `FOR SHARE`. Compare the immutable record with PR358's strict classifier.
6. Conflict or malformed evidence closes the socket without COMMIT. An exact
   record may commit, but a prior record returns `identical_record_only`.
7. A new row returns `issuance_commit_acknowledged` only after matching COMMIT
   command and idle ReadyForQuery ACK. Any uncertainty quarantines and destroys
   the socket, without reconnect, replay, retry or read-after-uncertain-commit.
   Any protocol-attempt error or unconfirmed close terminally quarantines this entry instance;
   later calls do not reopen a wire. This in-memory latch is not a persistent
   quarantine mechanism across restarts or separately constructed instances.

All results have `executionPermission: false` and `admission: NOT_ADMITTED`.
Neither read access, prior identical history nor acknowledged issuance consumes
dispatch/ingress claims or calls business SQL. Owner/store and SQL16 are unchanged.

## Precision contract

PR358 accepts canonical UTC millisecond strings only. The provider performs no
Date conversion, truncation or rounding. SQL18 must reject non-representable
sub-millisecond authority/approval/context limits before formatting them. SQL
clock comparisons remain at PostgreSQL microsecond precision; formatting a
diagnostic observation must never extend a validity limit or shorten a minimum.
The new SQL issuer must produce representable context limits and preserve the
original TTL and every upstream range. End-to-end verification of those source
comparisons and representable timestamps is a draft A integration prerequisite.

## Offline checks

Run with Node 26.13.0:

```sh
node scripts/ci/demo-authority-entry-review/run_review.mjs --output /tmp/demo-authority-entry-evidence
```

The isolated draft-only Actions workflow runs the exact three `test_*.mjs` files,
pins unchanged imported sources and uploads TAP plus a scope-labelled result.
The naming and runner are deliberately separate from the shared CI catalogue;
no catalogue or shared workflow is changed. Tests cover fixed query parameters,
malformed references/evidence, stale/revoked/fence mismatches, timestamp precision,
canonical derivation, conflicts, identical history, uncertain ACK, physical
session mutation, close failure and concurrent entry calls. They are protocol
doubles and consistency checks, not an actual PostgreSQL concurrency test.

## Still required

- Independent code and combined SQL17/18 integration review with exact source pins.
- PostgreSQL tests for ACL isolation, lock coverage, revocation/restore races,
  concurrent unique-key collisions, timestamp comparisons and error rollback.
- A real authenticated driver, owner authentication, isolated writer privileges,
  crash/recovery, durable cross-process quarantine and commit-ACK/durability evidence.
- Separate dispatch/ingress claims and in-business-TX authoritative guards.
- A reviewed deployment/activation decision. No DB was contacted; no roles,
  credentials, endpoints, remote migrations or runtime configuration were added.

The demo endpoint remains closed. This draft alone must never enable it.
