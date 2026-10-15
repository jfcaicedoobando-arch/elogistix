# Demo authority composition: offline design, operational HOLD

Reviewed source: main `025270cadcee0cedef64aab31be93eb0ff3f0288`.
This package adds offline composition tests and a proposed integration contract.
Deployment configuration stays **EMPTY**, the operational adapter **UNBOUND** and
the endpoint **CLOSED**. It supplies no resolver, database access, registration,
credential, role, grant, migration or activation.

## Existing contracts

| Boundary | Exact source contract | Remaining integration |
| --- | --- | --- |
| Canonical issuer | `docs/review/demo-durable-owner-adapter-20261015/issuer.mjs:11–25`: a protected resolver supplies tenant, semantic manifest identity, scheduler job, separately authorized occurrence, context and binding. Canonical key is `JSON.stringify([1, deployment, tenant, manifestIdentity, schedulerJob, authorizedOccurrence])`. | No resolver or issuance persistence entrypoint is configured. A hash establishes consistency, not authority. |
| Immutable history | `store.sql:4–18,23–43`: logical natural-key/context uniqueness, exact issuance-binding FK and dispatch/ingress stage uniqueness; UPDATE/DELETE/TRUNCATE rejected. | No runtime ACL or restoration fence is provided. An INSERT grant on the claims table alone does not separate dispatch from ingress authority. |
| Live claim | `store.mjs:2–28`: ingress requires the exact dispatch binding; this invocation must receive one INSERT RETURNING row and a confirmed claim COMMIT before receiving execution permission. | A SELECT of a previous claim, a context UUID, a timeout or an empty lookup grants no execution right. |
| Owner | `owner.mjs:14–38`: strict `{contextId}` request, authentication before wire acquisition, claimTX, guard, one businessTX, close; uncertainty quarantines. | Authentication, full binding/tenant/current-policy guard and business SQL remain trusted unconfigured integration boundaries. Raw business results do not certify financial checkpoints. |
| Physical driver | `driver.mjs:4–40`: one exclusive authenticated socket, immutable epoch/backend PID/start/database/session identity, real CommandComplete and ReadyForQuery, no retry/reconnect/replay/pipeline, terminal close. | Configuration evidence strings are references to evidence, not proof. A pool reservation or two HTTP RPCs cannot establish this contract. |

Issuer version is fixed at 1 in the store. Deployment partition and semantic
manifest family must remain stable over retries, rollouts and restores. Changing
context, TTL, snapshot, artifact version or retry metadata must not create another
logical obligation. Full natural-key uniqueness supplements the truncated digest.
An issuance conflict must not be handled by minting a new occurrence or rebinding
an old row. Current source deliberately leaves that caller contract unimplemented.

## Registry authority and the occurrence gap

The final proposed registry is
`docs/review/demo-flow-20261015/issuer/16-owner-registry.sql`. It replaces the
transport/read-access placeholders from file 15 when installed in the reviewed
order. Do not describe file 15's placeholders as the final implementation.

File 16 requires owner authority to issue (`39–47`); validates transport/policy
expiry, sponsor disablement, membership, privileged role and active tenant
(`50–77`); checks the authentic receipt/origin and policy snapshots before issuing
a context with TTL 1–300 seconds (`83–109`). Its RPC predicate requires current
owner, registered LOGIN session user, actual selected `service_role` and matching
role claim (`116–153`). Registries start empty and no real registration is supplied.

Its `server_admissions` generates context/run/lineage IDs, but has no protected
`authorizedOccurrence` field. There is no implemented mapping from that registry
to the durable issuer. A new context UUID, renewed TTL or changed manifest hash
cannot fill this gap. The proposed resolver must obtain an immutable authorized
occurrence from protected scheduler evidence and bind the corresponding producer
receipt, tenant, context/run/lineage, skip, policy snapshots, generation and expiry.
This envelope is a requirement, not a claim that those checks already exist.

The producer's receipt/admission must remain anchored. Its pre-materialization
idempotency path is not permission to regenerate receipts or contexts after
business materialization or an uncertain ACK. Unresolved execution stays sealed
or quarantined; a new occurrence requires separate authority.

## No-bypass contract and transport modes

`issuer/15-rpc-boundary.sql:20–33` prepares issuance, business and checkpoint in one
transaction. It does not consume `demo_owner_review.claims`. Its context-to-run
mapping is rollbackable. Direct permission to call that boundary can therefore
bypass the separate claimTX required by the durable owner. A reusable token sent
to two HTTP RPC calls does not establish at-most-once downstream execution.

The proposed capability plan must distinguish these trusted actors before any
real ACL changes are considered:

| Actor | Required scope | Must not imply |
| --- | --- | --- |
| Issuer | Read protected evidence and append the canonical issuance through a reviewed boundary. | Client-selected occurrence, binding override or raw claim/business access. |
| Dispatch controller | Consume only the approved dispatch stage for that exact issuance. | Authority to fabricate ingress or execute business. |
| Authenticated ingress | Supply only the validated context reference to the owner. | Authority derived from UUID possession or a historical row. |
| Sole owner executor | Confirm a new live ingress claim commit, retain one physical connection and admit one guarded businessTX. | A second attempt because a row exists, business rolled back or an ACK was lost. |
| Historical reconciler | Separately authenticated repeatable-read read-only evidence checks. | Issue, renew, execute, repair or convert absence into permission. |

External callers must not have raw issuance/claim writes, DDL-owner authority or
direct access to old/new business entrypoints. Per-stage authority needs a reviewed
SQL boundary/ACL policy; the stage CHECK constraint does not implement it. Schema
owners and superusers remain an explicit administrative trust boundary. This
document contains no proposed executable GRANT statements and certifies no ACL.

The current registry describes an RPC mode. PR350 tests a direct dedicated
PostgreSQL Client on an owned local socket. They need a reviewed common authority
contract before composition. Do not impersonate PostgREST by setting GUCs, weaken
the registry predicate, or label the laboratory Client an authenticated deployed
RPC channel. Existing infrastructure/principal/capability evidence is required.

## Human approval is separate from scheduler execution

`issuer/12-approval-main.sql:4–65` preserves the human helper: `auth.uid()`, the
canonical admin/admin_org/super_admin/contador rules, membership, row lock, CAS and
approval validator. Its body hash is
`d1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0`.
The demo branch uses `v_uid=NULL`, requires an issued run and verified candidate
(`130–164`), and records a mandatory demo event/current approval (`201–204`). The
private router distinguishes the branches (`208–211`). The registry's scheduler
context explicitly reports scheduler/job with human ID NULL (`16:148–153`): the
sponsor is not a human authenticated for that invocation.

The `demo-human-approval-review.yml` workflow exercises the reduced fixture in
`docs/review/demo-financial-runtime-20261015`. Its
`sql/02-synthetic-schema.sql:8–10` implements `auth.uid()` by reading a fixture
actor table. This tests helper branching, not external identity, deployed JWT,
application-role ACL or RLS. Its tracked PREPARED_NOT_RUN file is an earlier
snapshot. Current PR345 evidence is **24/24 PASS, synthetic human-helper scope**:
head `898729a2a83d29c47847cfb6d2f6187a3829a4ad`,
[run 38797160274](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38797160274),
artifact `12001599671`, ZIP SHA256
`b209256eff23db9756f44d2bd6c689005f47bd5167ac229043c45247404767e8`.
The coordinator verified that evidence through the GitHub connector. External
human authentication remains **NOT_RUN**; the earlier snapshot does not replace
the current run and the synthetic PASS does not establish authentic acceptance.

## Evidence and limits

The durable store SHA256 is
`fb7fa69c17eca7230606ecb6217086c6eb5317d75551df9efc268959f69140a7`.
PR344 producer/registry evidence is **PARTIAL_AUTHENTIC_PRODUCER_ONLY** at head
`348c974605fbd2516c0f80cdb3e472a21242a635`,
[run 38797446037](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38797446037).
It exercises the actual proposed producer/origin/registry against synthetic
tables and an owner fixture; unqualified RPC transport must be denied. It does
not certify real principals, external identity, full engine or durable dispatch.

PR350's durable record is `docs/qa/demo-wire-lab/runtime-evidence.json`, code
`9084f0249900491b50d944f34caf075d7a6ad2d3`,
[run 38813587064](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38813587064),
ZIP SHA256 `f1f230ca2c300e9e00c3bf4723dc1bf7c56f63fb5bed52f37e7ccb59fe2243dc`.
The final documentation head `cd20ee25718413f6ac7ee9124f7cd4e2cd82315d` also passed
[run 38814538137](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38814538137),
ZIP SHA256 `81f6b4cf46439bae1860e1e906716da6e2729dd2641d1d8fb85eecd724afad4a`.
Both audits found nine physical laboratory cases PASS, same complete runtime
manifest, distinct sockets, real protocol acknowledgments and confirmed cleanup.
Their traces differ by one unobserved late RFQ after a destroyed socket.

That fixture supplies synthetic issuer evidence (`runtime.mjs:38–40`) and
`authenticate: async () => true` (`52`); guard/business facts are synthetic too.
It certifies neither the registry connection nor real issuer, identity, engine or
ACL. Its fsync-off/tmpfs database proves committed visibility and rollback only;
WAL/crash/failover/restore durability is **NOT_RUN**. ACK cuts are deterministic
CommandComplete-boundary injections, not arbitrary network-loss coverage.

## Proposed isolated tests and next gates

`source-pins.json` records 19 selected source files from main `025270ca`, with
SHA256 and Git blob identity. Pins identify the Git blob bytes, not an arbitrary
working-tree rendering. A Windows checkout may expand LF into CRLF. The verifier
allows only an explicitly declared per-entry CRLF-to-LF comparison when that
entry's pinned Git bytes use LF. It does not rewrite inputs, apply general text
normalization or accept unrelated byte changes. This exception establishes source
equivalence only and adds no runtime or identity evidence.

The known gaps are assertions of preserved **HOLD**, not fixes to the original
entrypoints. A source assertion PASS means the reviewed unbound/deny behavior and
the missing ledger dependency remain recognized. It does not certify actual
database permissions, install ACLs or allow a direct caller to bypass claimTX.

`scripts/ci/demo-authority-contract-review/claim-authority.test.mjs` imports the
real owner, driver and fixed SQL. Only transport replies and persisted history
are scripted. It checks auth/config/preflight before access, zero-row consume,
insert error, uncertain claim ACK, guard revocation, server binding preservation
and historical-read denial. Unexpected SQL/parameters are retained as test
violations even though the real owner intentionally catches failures.

Its negative control deliberately bypasses the owner against a permissive scripted
effect sink. Fixture authentication plus the same UUID then permits two effects.
This is a counterexample to an incomplete composition, not a PostgreSQL execution,
an assertion that deployed ACLs are permissive, or another operational adapter.

The implemented companion files are `canonical-envelope.test.mjs` for protected
occurrence/semantic-family invariants and `entrypoint-contract.test.mjs` for
pinned entrypoint/capability declarations. The coordinator ran the complete
suite: **43/43 PASS** (22 canonical, 10 claim composition, 11 entrypoint), with
zero skips. All stay in this isolated directory;
original issuers, producer, owner, store, physical lab and product routes remain
unchanged. The isolated composition file uses Node built-ins only:

```text
node --test scripts/ci/demo-authority-contract-review/claim-authority.test.mjs
```

The complete registered CI lane runs through the catalog:

```text
node scripts/ci/test-catalog.mjs --output reports/demo-authority-contract-inventory.json
node scripts/ci/test-catalog.mjs --run node-demo-authority-contract reports/demo-authority-contract-inventory.json
```

Before connecting anything: review the authoritative occurrence resolver and full
binding schema; approve the sole-executor/no-bypass capability contract; provide
verified infrastructure for the selected RPC/direct mode; integrate authentic
producer/current SQL guards and read-only reconciliation; independently verify
durable claim history and restoration fencing. These operational gates remain
**NOT_RUN/UNBOUND**. The intended guarantee is at-most-once with quarantine and
an explicit availability cost, never exactly-once or guaranteed completion.
