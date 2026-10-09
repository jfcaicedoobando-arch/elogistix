# Audit145: preserve quotation sale adjustments during regeneration

> Historical implementation evidence. The source bases and results below belong to the original work, not to release46. This file is carried into a LOCAL composition on the proposed release46 tree `4f9c15bea974ce8ed2a22ab3c265ebd1e86ef06f`, which is a candidate and is not asserted to be published main. Current scope and validation limits are recorded in `audit145-current-main-local-review.md`. No new version is assigned, and migration145 is not registered in the release46 manifest.

## Provenance and scope

Forward-only integration onto main `003c8a7f4306e1f3ea0d7633985c496690b9e4b4` from the preserved, uncommitted reconstructed quotation work based on `dc7eae88affa61538b9d6a43da3e379640a1749e`. The reconstruction contained 22 modified and 8 untracked files. Its source checkout was not edited or cleaned; the complete tracked binary diff, untracked archive, status and source HEAD were preserved separately.

The previously unpublished migration `20261006164000_audit145_cotizacion_venta_lineage.sql` is integrated as `20261008000000_audit145_cotizacion_venta_lineage.sql`. No migration timestamp collision was present on the integration base. This timestamp follows the independently prepared audit54 residual (`20261007235800`) and audit147 (`20261007235900`). No release number, deployment or release-manifest change is part of this package.

## Behavior

- Each cost carries a stable optional `origen_venta_id`; derived JSON sale concepts carry `origen_costo_id`. A replacement of database cost rows preserves that business identity.
- Changing a linked source updates only the changed source fields. Manual sale quantity, unit price, description, notes, unit and tax classification remain intact when their source fields did not change.
- Manual and unverifiable legacy sales are retained. Existing rows are never linked by matching amount, description or array position. The explicit legacy-link UI explains the update and offers either one selected sale or a separate new sale.
- Completing a previously empty cost row generates its sale once; it is distinct from deliberately deleting a previously generated sale. Ambiguous replacements of legacy sources retain their pending-review flag without borrowing source identity or tax treatment.
- A tariff retains identity only for the same unambiguous tariff and surcharge source. LCL identity is retained only for the single old/new LCL source. Reordered surcharge rows retain their own identity.
- Regeneration preserves explicit tax rates, including when the current global fallback rate differs. Non-taxable, exempt and zero-rated treatment stays explicit.
- Deleted linked sources remove only their known linked sales. A manually deleted sale is not recreated on repeated step-2 synchronization.

## SQL safety

The migration adds a nullable column and partial unique index, replaces the complete existing RPC body, and retains its signature, row lock, optimistic timestamp check, organization/writer validation, allowed quote states, shipment guard, idempotency and ACL. Existing historical rows are not backfilled or rewritten. Duplicate source UUIDs are normalized through the UUID type before comparison so alternate textual casing cannot evade the explicit duplicate guard. Failed row insertion rolls back the entire cost replacement.

The effective RPC on the old source and current main had identical SHA256 `4fcae92d7539bdf9385a578c77886b652369857c7fda94c5bd2ec6bb3668ae83` before this patch. No later security fix is overwritten.

## Dependencies and overlap

Audits148,62/130 and139 concern insurance invoice identity, supplier invoice capture and shipment closure debt, respectively. This package does not touch those functions or frontend domains and has no direct dependency on their pending changes. The shared guard inventory is extended without removing any existing entry. The Supabase type file receives only the new cost column. Future release composition must regenerate the schema baseline against the full selected migration set and update the release manifest then; it must not restore an older complete baseline or manifest.

## Interruption boundary

The existing wizard persists costs in step2 and sale concepts in step3. This package preserves that contract. Tests cover failed cost persistence followed by retry, waiting for persistence before local synchronization, repeated synchronization, UI selection cancellation/replacement, and rehydration of saved cost/source identities. It does not claim one atomic database transaction across both wizard steps. Closing the wizard after step2 has committed but before step3 has saved can leave the existing persisted sale snapshot unchanged; no historical sale rewrite or inferred repair is introduced. The existing local draft v3 also saves form values, costs and the current step, but not the sale arrays; `useDraftRestore` does not restore those arrays. Complete restoration of unsaved manual sale edits after a page reload is a separate known gap and must not be marked fixed by this package. A separate local follow-on now addresses that boundary with versioned sales/FX/synchronization snapshots and protected restoration; see [the draft-recovery review](audit145-local-sale-draft-restore.md). It does not alter the reviewed SQL below.

## Validation

Validated locally with PostgreSQL17.9, Node24.19.0, one Vitest worker and a 3072 MiB Node heap. Heavy stages run serially under the shared validation lock:

- 105 focused Vitest tests in 14 files and the complete quotation feature (1,141 tests in 157 files) passed on the final code; scoped ESLint and app/node TypeScript checks passed.
- The final minified production build passed in 55.99 seconds using a supported single Terser worker after an initial parallel-build process termination. Bundle-size and sourcemap gates passed; entry gzip is 207 KiB under the unchanged 365 KiB budget.
- Fresh replay and forward replay from the exact main base yield the same full schema.
- All 187 SQL guards and 49 RLS suites passed. The extended audit145 guard passed both fresh and forward.
- The RPC signature, owner, ACL and security configuration are unchanged. Seeded historical cost and sale rows were byte-equivalent in JSON before/after, apart from the new nullable column excluded from the comparison.
- Migration hygiene, complete schema functions and replay-mirror audits passed. Replay-mirror retains the same 2 documented pre-existing divergences.
- The tracked canonical baseline is the generated PostgreSQL 17.9 snapshot of this exact base plus audit145. Its only delta is the RPC body, nullable source column and partial unique index; there is no ordering-only normalization or ACL/owner change. The migration release manifest is unchanged.

Exact final hashes and any broader validation results are recorded in the coordinating evidence bundle. No remote SQL, production deployment, PR publication or merge was performed by this integration task. Independent review and coordinated release packaging remain required.
