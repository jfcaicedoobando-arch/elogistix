# Demo authority bridge: pure review contract, operational HOLD

Base reviewed: `b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa`.

This package is an **offline mapper and contract proposal**, not an authorization
implementation. It adds no evidence provider, real authentication, operational
`businessGuard`, database access, SQL statement, role, grant, credential,
registration, migration, application route or product activation. The existing
endpoint stays **CLOSED**, configuration **EMPTY**, and `SQL.business` **UNBOUND**.
No existing issuer, owner, producer or SQL source is changed.

## Inputs and trust boundary

`scripts/ci/demo-authority-bridge-review/contract.mjs` exports only:

- `mapDeclaredVerifiedSnapshots(value)`: a pure projection of a declared
  pre-verified snapshot bundle into the existing issuer resolver's result shape.
- `validateBinding(value)`: strict shape and chain correspondence validation of
  the proposed immutable binding. Historical validation is not a live guard.
- `classifyDeclaredIssuance(proposal, history)`: exact conflict classification
  over declared immutable-ledger projections. Every result includes
  `executionPermission: false`.

The declaration string `PREVERIFIED_PROJECTIONS_NOT_AUTHENTICATION` is a scope
label, **not proof**. Any caller can fabricate coherent inputs that pass. The
tests deliberately demonstrate this. Do not bind this module directly to request
data, use it as an operational resolver/business guard or expose it through HTTP.

The DTOs are strict camelCase projections of the reviewed SQL evidence. They are
not raw database rows or a replacement for authentic origin/receipt validation:

| Projection | Existing evidence source and correspondence |
| --- | --- |
| `schedulerApproval` | `scheduler_approvals`: approval, transport, job, tenant, sponsor, manifest artifact, approving owner, validity and disabled state. |
| `transportApproval` | `transport_approvals`: owner/login/technical role OIDs, tenant, approving owner, validity and disabled state. OIDs and names are declared data, never proof of actual session role. |
| `preparationAdmission` | `preparation_admissions`: approval, exact normalized scheduler/transport snapshots, admitting owner, review reference, origin kind and deadline. |
| `preparationRun` | `preparation_runs`: admission, receipt, scheduler, owner, scheduler actor/job, tenant, manifest/source digests and client-binding digest. |
| `receipt` | Verified `prepared_receipts`/origin output projection: receipt and source-run identity, tenant, manifest/source metadata and client-binding digest. |
| `serverAdmission` | `server_admissions`: context/run/lineage, approval/transport and their snapshots, receipt/source metadata, owner, issuance and validity window. |
| `serverContext` | `read_server_context`: corresponding context/run/lineage/tenant, manifest, receipt/source, declared session principal, scheduler actor/job, NULL human, initial purpose and validity. |

For example, `organization_id` becomes `tenant`, `manifest_version` becomes
`manifestVersion`, and `identity_sha256` becomes `identitySha256`. The future
provider must first perform the actual owner/session/current-policy checks,
membership and sponsor checks, complete raw admission/fixture/receipt verification
and authenticated reads. The mapper neither reads nor independently verifies
category/supplier/shipment/client arrays, receipt payload hashes, actual owner OIDs
or current role membership. Existing receipt/origin verifiers remain necessary.

The normalized approved-policy snapshots must correspond exactly across
admission and server context. All nested objects have closed schemas: omitted and
extra properties, non-JSON types, accessors, symbols and inherited fields are
rejected. Output is a detached recursively frozen copy with deterministic schema
ordering; JSON object insertion order alone does not cause binding conflicts.

## Missing protected record and restore state

The mandatory `protectedAuthority` projection describes a **new, unimplemented
protected evidence requirement**. Neither the existing registry nor this package
creates it. It must explicitly bind:

- Independent record reference and stable deployment/tenant
- Semantic manifest family, scheduler approval/job and separately authorized
  occurrence
- Corresponding preparation admission and authentic receipt
- Governed `skipMs`, a nonnegative safe integer; zero is valid, negative,
  fractional, nonfinite, unsafe, coerced and negative-zero values are rejected
- Generation and restore fence, with an explicit validity window and revocation
  state

`restoreState` supplies the separately declared current deployment/generation/fence
for model comparison. Matching strings and numbers do **not** establish a real
restore fence, immutable storage or crash/failover durability. Their trusted
storage, administrative boundaries and atomic enforcement are still unimplemented.
`observedAt` is supplied explicitly; the mapper does not read a clock. Validity is
half-open, `[notBefore, expiresAt)`, and the reviewed context TTL is capped at
300 seconds and cannot exceed admission, policy or protected-record deadlines.

Missing occurrence, semantic identity, governed skip or restore data causes HOLD.
No UUID, receipt, source run, TTL, digest or snapshot can fill these gaps. Caller
fields or a second override argument are rejected. Scheduler sponsorship remains
distinct from a human authenticated for this invocation: the context must report
`initiatorKind: scheduler` and `initiatorUserId: null`.

## Natural key, binding and conflict semantics

Tests import the unchanged **real `createIssuer`**, supplying a conspicuously
synthetic resolver. This package has no second digest or obligation-ID algorithm.
The canonical natural key remains exactly:

`[1, deployment, tenant, manifestIdentity, schedulerJob, authorizedOccurrence]`

Generation/fence belong to the binding, not this natural key. Context/run/lineage,
TTL, artifact snapshot, producer receipt/source run, governed skip and observation
metadata never manufacture another occurrence. Observation time is not persisted
in the binding. Changing other bound evidence retains the obligation and causes
an immutable binding/context conflict if an issuance already exists.

The classifier takes strict ledger-row projections with `canonicalVersion`,
deployment, obligation ID, natural-key fields, context and full binding. Each row
must agree with its binding. It checks declared uniqueness before comparing;
duplicate natural keys, contexts or obligation IDs within a deployment cause
`HOLD_HISTORY_AMBIGUOUS`. This is not a database query or concurrent insert result.

| Classification or conflict | Exact meaning |
| --- | --- |
| `NO_CONFLICT_IN_DECLARED_SNAPSHOT` | No matching natural key, context or obligation ID in the supplied history. This cannot certify absence or authorize an insert. |
| `IDENTICAL_RECORD_ONLY` | Natural key, obligation ID, context and normalized binding all match. This grants no retry, dispatch, ingress or business permission. |
| `NATURAL_KEY_ID_MISMATCH` | Same natural key, different stored obligation ID. No reminting or repair. |
| `NATURAL_KEY_CONTEXT_CONFLICT` | Same natural key, different context. |
| `NATURAL_KEY_BINDING_CONFLICT` | Same natural key, different full normalized binding. |
| `CONTEXT_REUSE_CONFLICT` | Same deployment/context belongs to a different natural key. |
| `OBLIGATION_ID_COLLISION` | Same deployment/obligation ID belongs to a different natural key. |

Any conflict yields `classification: CONFLICT`. Simultaneous causes are preserved
as a sorted set, rather than hidden by precedence or history order. The classifier
does not recompute the ID; provenance requires the real issuer and reviewed
persistence boundary. Results grant no permission, including an exact record or
an empty history. No mutation, retry, occurrence minting or rebinding is performed.

## Revocation, businessTX and SQL15 remain open gates

The model rejects declared scheduler/transport disablement or authority revocation
and mismatched restore state. It does not certify runtime ACL or revocation.
The current owner executes `businessGuard` **before** `BEGIN`; revocation can race
after that callback. The future actual business statement must revalidate all
current authority, binding, generation/fence and policy requirements **inside
businessTX** with the reviewed locking/serialization semantics. This mapper does
not supply that statement or eliminate the race.

SQL15 `prepare_execute_checkpoint` still performs its rollbackable wrapper flow
without consuming `demo_owner_review.claims`. It cannot stand in for the durable
owner's separate committed claimTX. Direct old/new business entrypoints, raw
claim writes, stage capability separation and reconciler-only access still need
the reviewed no-bypass contract and authentic infrastructure/ACL evidence.
Operational composition remains **HOLD**.

## Verification and automatic lane

Run the focused package with Node 24.19.0 and no dependencies:

```sh
node --test scripts/ci/demo-authority-bridge-review/*.test.mjs
```

Local focused result: **68/68 PASS, zero skips**, consisting of 42 binding,
17 conflict and 9 integration/source/census tests. This local workspace contains
selected verified files, not a full checkout. Its census regression is explicitly
representative, not a claimed full-repository local census. Twelve canonical
source pins are verified against SHA256, Git blob identity and byte count; only
declared CRLF-to-LF checkout equivalence is accepted for LF-pinned text.

Seven local mutation controls were rejected by the same focused tests: accepting
extra fields, accepting unsafe skip values, ignoring restore fence, ignoring
declared revocation, dropping binding-conflict detection, granting execution on
classification, and promoting a sponsor UUID into the human actor field.

The existing unconditional CI detector now runs the new exact lane after its
complete repository inventory and pinned Node setup:

```sh
node scripts/ci/test-catalog.mjs --output reports/test-inventory.json
node scripts/ci/test-catalog.mjs --run node-demo-authority-bridge reports/test-inventory.json
```

The three exact test paths are registered without renaming/excluding existing
tests or changing previous lanes. Missing, duplicate, extra, manual and drifted
entries fail. An unregistered test fails classification. Full inventory and
existing integrated regressions must pass on the draft PR's exact head in Actions
before this package is considered reviewed for integration.

External authentication, real provider, operational business guard, runtime ACL,
live revoke/restore enforcement, crash/failover durability and product activation
are **NOT_RUN/UNBOUND**. No database or real fiscal operation was performed.
