# Financial, exact coverage and insurance restore: CI candidate49

## Scope and provenance

This local candidate composes main `3f962cc9cd3d4369d914b1b6779e9aabc7eaa3d0`
(tree `96cdf9690b7d8afb896efd01000fcd3c6b98b619`) with the frozen reviewed
financial/coverage/restore tree `bc3234e9e1815a7267870bbe1596066d037d6053`.
All 30 concurrent CRM/tarifario paths remain exact current-main blobs. The reviewed
release 47 tree `9389d7828bad412f64c57f1d3baddfcbd9101746` and PR179 functionality
are retained. PR179 remains a separate unchanged draft at `8f04f0e4`;
this package neither replaces its remote branch nor claims it was published.

The pre-existing release 48 composition contributes the six reviewed financial
forwards for collections54/141, demurrage147, quotation145 and P&L129/132/148,
as well as the prior release 47 noncash corrections. Coverage/restore adds the
previously staged source with no functional body changes. Selector/tenant
integrity is a separate dependent candidate and is not included here.

`20261007023000_audit99_121_historial_ajustes_no_monetarios.sql` retains its
reviewed release 47 provenance comment. Compared with original PR179, only the
first comment differs; every byte after that line is identical. This is a
repository provenance fact, not permission to rewrite an applied ledger or
claim that any destination migration was applied.

## Immutable registration

APP_VERSION 13.824.49 registers 1,505 SQL files. All 1,503 prior migration bytes and
modes stay exact. Manifest history 35–44,46,47,48 is preserved literally, without
creating 45 or pruning prior versions. Prior changelog entries remain literal
historical records of their original candidates.

Two new migrations are ordered after the existing release 48 P&L forward:

1. `20261009010000_audit148_cobertura_documental_exacta.sql`
2. `20261009010100_audit148_papelera_seguros.sql`

Each embeds its entire reviewed staged source exactly once, including original
comments. Original raw-source SHA256 values:

- Coverage: `663731d9f0ec82d7b2e1facf756a64b2d09d81f2046e38dc118eec4e0dbaa266`
- Restore: `2a3ee94273fdfd7730c5c54acf1c52e598237ff1c868eb25d421eb631748643d`

The outer envelope is new packaging code. Evidence for the old source bodies
does not validate this new envelope's runtime.

## Fail-closed envelope and transaction contract

Each file starts executable work with SAVEPOINT. Run the complete file with
one caller-owned transaction and stop-on-error, such as `psql -X -v
ON_ERROR_STOP=1 --single-transaction`. It does not issue BEGIN or COMMIT. An
autocommit runner is unsupported and must fail before persistent changes.
Existing release 48 SAVEPOINT/ACL requirements also remain unchanged.

Preconditions require existing targets, the postgres owner/grantor identity,
reviewed pre- or post-body hashes, known signatures/attributes and explicit
closed PUBLIC/anon ACL. Callable RPCs must already have the exact direct
owner/authenticated EXECUTE entries without grant option. The insurance
trigger must already be closed to authenticated callers. Unknown grantees,
grantors or grant options fail closed. service_role access is preserved as
found and is never granted or revoked.

The repeated DCL only reaffirms those existing entries. The trigger uses the
existing auditor's private-trigger rule and gains no client grant. A
transaction-local snapshot compares target OIDs, every nonbody pg_proc field,
raw/expanded ACL and effective privileges for every role after replacement;
exact expected body hashes are checked too. A mismatch raises and aborts the
caller transaction. No persistent helper, RPC, table, policy or role is created
by the envelope. The reviewed coverage source retains its intentional trigger
replacement/event-column extension, whose physical trigger OID can change.

## Baseline and validation boundaries

`baseline.sql` remains byte-identical to normalized tree bc3234e9, SHA256
`50abe8577354d4880c32ce27d81943c6f0506df5e6f87f619c2301a0f0591579`.
It already matches both recorded native PostgreSQL 17.9 normalized dumps.
The new wrapper contains only transaction controls, DO checks and no-op DCL;
it is expected to leave that schema unchanged. No new dump or SQL execution
was performed for this packaging. The CI harness's extra trigger grants do
not define the original target ACL used by the installer precondition.

Targeted static gates: migration manifest, migration hygiene, native replay
mirror, canonical functions, schema columns, test inventory and source/history
preservation. Existing auditors and exception fingerprints remain unchanged. The existing
RLS job now opts into the two exact pre-file financial installer controls,
with path filters and always-uploaded `.financial49-logs` evidence. No separate
workflow or database destination is introduced. Full CI/build/functional/UI results must refer to the exact future
published commit; this document does not label omitted stages as passed.

## Remaining publication and application gates

- Independent review of the new envelope and exact candidate inventory/diff.
- Git publication availability and fresh main/PR179 ref reconciliation. No
  remote Git writes were made by this packaging task.
- Exact-commit GitHub Actions, including native pinned 17.9 replay/baseline,
  functional guards and RLS. The wired `scripts/ci/financial49/test-envelope.mjs`
  runs before each exact registered file in owned pre-install clones. It checks
  fresh/second apply, successful caller rollback, autocommit refusal, unknown
  body, PUBLIC access, missing direct authenticated grant, grant options, private
  trigger exposure and injected postcondition failure with full dump/target
  metadata equality. It drops only clones it created. No runtime result is
  claimed until that exact GitHub job completes.
- Compose the separately reviewed selector/tenant-integrity change only after
  this base. It is not needed to claim this package's source identity, but is
  needed for the complete authoritative-selector outcome.
- Before any database application: verify destination identity, ledger/file
  hashes, missing-file list, catalog/ACL and whole-file transaction support.
  Select missing migrations explicitly; some inherited47/48 IDs precede46.

CI green does not prove remote database state, published frontend, deployment,
fiscal activity or GUI acceptance. No database application or deploy is part of
this candidate.

## Exact historical predecessor admission (2026-10-09)

The restore49 installer also admits one exact historical raw `list_trash`
predecessor: `e22add636e68c503bd302cd7711db80be628a4f228e5cb46a20512a717835c5f`.
The canonical predecessor `f121b65e081df7977f02f4ee45f7720b1fe5d9426cb711b96847033db71e3085`
and final target `37156604926923420499bfeba6b921d9c9ad0343b371de32002c5260be5c75fd`
remain unchanged. Exact source comparison identified only three extra empty
lines in code, outside quotes/comments; all 67 quoted tokens are byte-identical.
The historical variant was observed in the preserved 2026-10-08 catalog and
reconfirmed by a read-only destination query on 2026-10-09. The ten financial
migration IDs/names were absent at that admission check; no applied migration
or destination ledger was rewritten.

No whitespace normalization is used for admission. The additional hash is
accepted only for `public.list_trash(text,integer,integer)`. Every other body,
owner, identity, attribute and ACL gate remains unchanged, as do both exact
final bodies, the embedded reviewed source and the normalized baseline.
The release manifest records filenames rather than source hashes; its entries
and bytes are unchanged. The CI config pins the revised installer bytes.

One extra owned-clone Actions control installs the exact hash-pinned historical
definition without DCL, checks its raw body and unchanged metadata/ACL, runs
the real installer in a caller-owned stop-on-error transaction, then verifies
both exact final bodies plus raw/expanded/effective ACL and nonbody metadata.
The existing unknown-body rejection control remains intact. The clone joins
the existing owned-only cleanup. This brings the planned envelope controls to
20 (10 coverage, 10 restore); runtime success requires the new exact-head CI.
