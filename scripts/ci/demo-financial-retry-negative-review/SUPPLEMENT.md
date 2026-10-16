# Additional synthetic probes: PREPARED / SQL NOT_RUN

This supplement adds files only. `delivery-lock.json` verifies all nine files
from commit `fd3a2fcb940dc122fda7be242afda05a053dd61d` remain byte-identical.
The first delivery and its historical evidence retain their original scope.
No author fixture, runner, engine, issuer, migration, workflow, role or grant is
changed. Use the same reviewed PR354 fix version
`a7aff9ff8f92852687c56d3bc05d41150b44b2ae`; the author must also record and
verify the actual integrated checkout and unchanged proposed correction bytes.

| Additional case | Positive prerequisite | Expected denial |
| --- | --- | --- |
| foreign_bound_concept_id | Genuine fresh identity verification before and after constructing auxiliary parent | 23514 DEMO_FINANCIAL_ADOPTION_DENIED |
| foreign_bound_payment_id | Genuine fresh identity verification after canonical human approval and complete actor fixture restoration | 23514 DEMO_FINANCIAL_ADOPTION_DENIED |
| tenant_authority_reassignment | Genuine materialization and unchanged successful same-context retry | 42501 DEMO_SPONSOR_MEMBERSHIP_REQUIRED |

The first two cases use only the measured prepared receipt's target financial
UUID. Auxiliary parent/concept IDs come from canonical column DEFAULTs and
RETURNING, and must be disjoint from every bound financial ID. The independent
collision matrix requires zero bound invoices, exactly one target bound concept
or payment, and zero occupancy in the other target table. The positive check
after auxiliary construction prevents an origin/approval failure from being
counted as the intended adoption denial. Origin validation must still succeed
after inserting the foreign target. No private evidence or writer claim is
created or modified.

The payment case uses the existing sponsor's synthetic actor fixture to execute
the actual `common_approval` human branch with canonical roles, tenant membership,
live shipment, source concepts and current invoice version. Its own helper sets
the canonical approval guard; the test does not set that guard. The existing
auth_context is restored exactly before the second positive identity check.
This remains synthetic identity support, with no external authentication claim.

The tenant case moves the sponsor's sole existing membership from the original
tenant to the second active tenant measured from the two manual sentinels.
Only `organization_id` changes; the global role and attested context tenant stay
unchanged. Repeating that same context must fail the original tenant membership
check before the global role check. This tests current tenant-scoped authority.
Changing the attested tenant identity or authenticating a different external
tenant caller remains BLOCKED by the existing immutable evidence/tenant CHECKs
and absent second-context/authentication fixture. Neither UUID substitution nor
JWT editing is substituted for that missing evidence.

## Author integration

Cherry-pick the supplemental commit after the first delivery. Load
`supplemental_suite.py` by path, as documented for `suite.py`. It exports:

```python
review.CASES                         # three additional cases only
review.BLOCKED_CASES                 # attested tenant identity switch remains blocked
review.suite_sql(case_id, sources, author_fix_head=fix_head)
review.negative_sql(case_id)          # suffix only, once after verified setup
review.inspect_result(case_id, stdout=out, stderr=err, returncode=code)
review.sequence_control_sql(sources, author_fix_head=fix_head)
review.inspect_sequence_control(stdout=out, stderr=err, returncode=code)
```

`sources` is the same mapping of the exact three external fixture byte arrays
required by `contract.json`; `fix_head` is the exact version above. `suite_sql`
and `sequence_control_sql` prepend those fixtures unchanged, including synthetic
setup COMMITs. Never execute that prefix twice in a session. Source pins and the
declared version do not authenticate the runtime; the author runner establishes
checkout/container ownership and the complete installation/proposal hashes.

Execute each of the three additional negatives and the separate sequence
calibration in its own **fresh owned synthetic database**, using the existing
author runner, PostgreSQL17.6, pinned image, network none, local socket and
synthetic owner/technical role. Preserve its reviewed laboratory manifest
variant and its hashes. Run all bytes for one invocation in one psql session,
`-X -q -A -t`, ON_ERROR_STOP enabled, SQL/echo-all disabled. This provider does
not connect, create containers, accept DSNs or run a real database.

Native mutations/proofs stay outside the expected-error subtransaction. After
the exact denial, the common wrapper checks full table-row equality and manual
sentinels, rolls back the business transaction, then checks the prepared baseline.
The unchanged positive retry is uncaught. Unexpected failures must stop the case
and must remain failures; cleanup must still run in the author-owned runner.

## Sequence evidence is separate from table-row rollback

`sequence_observation.py` creates one session-local SECURITY INVOKER observer.
Its normal path discovers all sequences in the exact five snapshot schemas,
reads `pg_sequences` metadata and safely quotes qualified names to read
`last_value,is_called`. It never calls nextval or setval on those sequences.
It prints framed JSON at baseline, after the materialized positive control,
before/after denial and after outer rollback. Fresh cases omit the materialized
positive phase; their native identity controls are described above.

`inspect_output` requires every expected frame, label, scope, sequence count,
type, order and successful read. Missing/inaccessible metadata is INCOMPLETE,
never an empty inventory. Complete empty inventories are reported as `absent`.
Comparisons report `changed`, `no_change` or `absent`. They do not assert that
sequence state was rolled back, that no sequence was consumed, or that changes
were caused by the RPC. Cached consumption may leave observed last_value unchanged;
catalog/state reads are not atomic, and same-name replacement is not excluded.
Sequence OIDs and raw error messages are not emitted.

`sequence_control_sql` is a separate calibration, not a fourth denial case. It
creates a new dedicated TEMP sequence **before** BEGIN, deliberately configured
START17/INCREMENT7/CACHE1. Only after the actual materialization and unchanged
retry succeed does it call nextval twice on that TEMP object. After outer
ROLLBACK the native observations must show 17/uncalled → 24/called → 24/called.
This demonstrates the advanced TEMP state remains visible after rollback when
executed; it does not modify, reset or characterize a fixture sequence. Here the
calibration is prepared and remains NOT_RUN.

The parsers' strongest status remains
`ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP`, with admission NOT_ADMITTED and
sequence_rollback NOT_ASSERTED. Preserve native stdout/stderr/exit status, actual
source/rendered SQL hashes, integrated commit and verified cleanup. Sample JSON
streams in offline tests test parsers only; they are not native SQL evidence.

Run offline checks with the original command in README.md. The supplemental
artifact lists the exact current test count and rendered hashes. Full ERP replay,
real authentication/RLS/transport, business COMMIT, sequence/WAL/crash durability,
deployment and merge remain outside these prepared probes.
