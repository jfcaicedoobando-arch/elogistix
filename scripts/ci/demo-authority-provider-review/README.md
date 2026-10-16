# Protected occurrence / direct owner authority reader

Status: NOT_ADMITTED. Proposed SQL only, outside migrations. No application DB, configured authority row, new credential, real permission, endpoint, seed or deployment is changed. The fixture uses an owned empty network-isolated PostgreSQL 17.6 container in this draft's Actions lane.

## Contract and scope

The proposed SQL17/18 payload is in `docs/review/demo-authority-provider-20261016/issuer/`. It is a separate review package. The historical `demo-flow-20261015` payload, SQL16, manifest and verification policy remain unchanged; adding proposed files never changes that frozen evidence.

SQL17 adds an empty protected occurrence registry, append-only revocations, immutable 1:1 occurrence/context bindings and a deployment fence whose default is stopped. Missing fence configuration also denies. Its natural key is deployment / tenant / semantic manifest family / scheduler job / explicitly approved occurrence. Context IDs, source receipt, artifact version/hash, generation, fence and TTL never regenerate this key. Registration is an explicit existing-owner-only act; this package registers no real authority.

SQL18 provides `SELECT demo_flow_writer.read_authority($1::uuid) AS authority`. The sole input is a bound context ID. Caller JSON, tenant, actor, occurrence, skip and success flags are not accepted. The SQL authenticates both current and session user through the unchanged SQL16 catalog-owner check, resolves protected references, executes the unchanged scheduler, authentic origin and identity receipt validators, and emits the exact camelCase PR358 shape. The mapper is unchanged and remains a format/correspondence validator, not authentication.

The direct owner reader does not invoke or replace SQL16 `read_server_context` or assert an authenticated RPC. `serverContext.sessionPrincipal` is the registry-approved delegated transport login. It is descriptive, not proof that that principal is connected. The actual reader connection is the existing owner, and no new owner connection or credentials are configured here. Direct owner vs RPC business composition remains open.

Use a dedicated READ COMMITTED transaction. Fence `FOR SHARE`, occurrence `FOR UPDATE`, binding/context and underlying validator row locks remain until transaction end. The revocation function and its BEFORE INSERT trigger lock the same occurrence row, closing the absent-revocation race. Revocation and reader serialize; success never grants future dispatch or business. App principals have no new grants. Installers close default ACLs on only their newly created objects.

## Text compatibility boundary

The unchanged PR358 mapper is still required after this reader. Existing upstream preparation references can be wider than its trimmed/control-free 256 UTF-16-unit text contract; PostgreSQL character counts also differ from JavaScript UTF-16 lengths for non-BMP text. Such projections are rejected by the mapper and cannot proceed. This review does not normalize historical text or claim every authentic upstream row is mapper-compatible.

## Exact timestamp contract

All source validity bounds must be finite and exactly millisecond-representable; a sub-millisecond bound is rejected with `DEMO_AUTHORITY_TIMESTAMP_PRECISION`. No expiry, approval deadline or protected lower bound is rounded or widened. UTC serialization uses exactly `.sssZ`. The PG authorization clock remains native microseconds before and after projection.

SQL16's historical issuer and `issued_at DEFAULT clock_timestamp()` are untouched. Existing admissions are never normalized, updated or rebound. The new proposed `issue_bound_context(authority_id)` derives the scheduler and receipt, creates and binds exactly one new admission atomically, explicitly records a millisecond issuance tick, and bounds expiry by that tick + 300 seconds and every exact upstream/protected deadline. The tick is at most less than one millisecond before the actual issuance time, so it cannot extend the 300-second maximum. Protected not-before is never moved earlier. A second call returns the same still-valid context or fails; expiry/revocation never produces a replacement. Only informational `observedAt` is projected to a millisecond tick; raw PG time decides admission.

## Evidence

`python3 -m unittest discover -s scripts/ci/demo-authority-provider-review -p 'test_*.py' -v` runs source and gate tests without DB or network. These do not certify native behavior.

Actions alone may run `run_ci.py --execute-disposable --output <new-path>`. It verifies the exact draft branch/head/integrated base and pinned unchanged source files; creates an owned container with `--network none`, no host ports or bind mounts; bootstraps disposable compatibility roles separately; executes all candidate SQL as NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB owner; checks empty registry/ACL, actual outsider denials, valid chain, natural-key conflicts, immutable bindings, unsafe scalar/timestamp rejections, authentic policy/entity drift and revocation; feeds native JSON into the original PR358 mapper; observes a real second-session revocation waiting on the reader's lock; and verifies shutdown/removal of only owned resources.

The synthetic schema is not full main-schema equivalence. The catalog core function is an unchanged fail-closed ownership fixture, never executed as business. The authentic producer, scheduler, origin and receipt validators are pinned unchanged. `result.json` must contain PASS and verified cleanup before native evidence is accepted. No local SQL/Docker execution is supported. No historical evidence is relabeled. Supplemental native controls cover context reuse denial, authentic SQL16 sub-millisecond rejection, authority expiry without renewal, and a separate exact 2-second owner-created context fixture: read succeeds before expiry, the authority remains valid afterward, read/issue then deny without replacing the binding or extending TTL. The latter is consumer evidence, not custom-TTL support in the new issuer.

Still NOT_RUN / NOT_ESTABLISHED: real identity/ACL provisioning, authenticated RPC transport, dispatch, durable ingress claim, business transaction guard, business COMMIT, external restore fence, WAL/failover/restore guarantees and runtime activation. A same-database fence cannot prove that a restored copy is fresh; restored apparently coherent state remains NOT_ADMITTED until an independently designed external admission exists.
