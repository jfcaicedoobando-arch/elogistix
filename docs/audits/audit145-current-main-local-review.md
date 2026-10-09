# Audit145: local composition on the proposed release46 package

## Current provenance and release boundary

The implementation comes from the reviewed 56-path audit145 candidate tree
`e5d5abd1ac6cb6a24de5e4315c4679d8f640f865`, previously composed on main8ed.
The new base is the **proposed, local release46 package**, tree
`4f9c15bea974ce8ed2a22ab3c265ebd1e86ef06f`; it is not claimed to be published
main. Its approved working-tree inventory, not its older cc40 ancestor HEAD,
is the source of truth.

No new application version is assigned. The existing release46 app version,
changelog, release manifest and its 1,495 registered migrations remain byte
identical. Audit145's existing migration is carried over unchanged, is not
renamed or registered in that manifest, and remains pending release packaging.
Consequently the manifest gate must not be described as green.

- Audit145 migration: `20261008000000_audit145_cotizacion_venta_lineage.sql`.
- SHA-256: `80c1282ad95409da623267ea9a681f2f22545f84eb1bc66a76ef90aba59f8681`.
- No additional migration, release or SQL execution is introduced here.

## Bounded composition

The source and base diverge at only three audit145 paths:

- `supabase/schema/baseline.sql`: transplant only the existing audit145 RPC
  body delta, nullable lineage column and partial unique index. Every other
  release46 byte, including provisional-provider functions and corrected
  approval body, is retained. This is a static composition, not a new database
  snapshot.
- `src/integrations/supabase/types.ts`: add only the three nullable/optional
  `origen_venta_id` fields for cotizacion_costos Row/Insert/Update. All release46
  signatures and types remain intact.
- `supabase/tests/_guards_manifest.txt`: append the existing two audit145 lines
  to the complete release46 file. The provisional-provider functional guard
  remains registered.

The four audit145 documents update provenance. The other 49 source paths are
byte-identical to the reviewed source145 candidate. UI199, security guards,
workflows, harnesses, dependencies, lockfile, historical SQL and unrelated
features are preserved from the proposed release46 base.

## Validation performed on this composition

Executed again on this composed source tree on 2026-10-08:

- 199 focused quotation/Pricing tests in 20 files: PASS.
- 137 UI199 and release46 architecture/replay-hygiene/RPC contract tests in
  14 files: PASS. These are unit/static-contract checks, not PostgreSQL replay.
- Total: 336 passed tests in 34 distinct files; no full-feature/repository claim.
- Complete TypeScript app and node checks: PASS.
- ESLint on 49 TS/TSX paths (47 audit145 plus two Pricing paths): PASS,
  zero warnings.
- Migration hygiene, canonical schema functions, replay mirror, RPC sync and
  schema-column static auditors: PASS. Replay mirror retains the two exact
  historical R4BD-01/R4BD-03 divergences; 204 signatures / 180 canonical files.
- Full-tree invariants and exact patch replay: PASS. Reverse-applying only the
  reviewed 145 hunks recovers baseline46 and types46 byte for byte. All 8,506
  unaffected base files and the ten UI199 files remain identical.
- Release manifest: exit 1, exclusively because the existing 145 migration is
  deliberately unregistered. This packaging blocker is preserved, not waived.

Checks were serialized with the shared heavy-validation lock, one Vitest worker
and a 3,072 MiB Node heap. The offline network fence stayed enabled; 12 blocked
socket attempts were recorded during the six TSX static-auditor stages. Their
current raw log has no target/stack; no destination identity is inferred from
that log. The tests are mock-backed and do not verify live backend transport.
Exact commands, logs, exit codes and source-preservation metadata are retained
in the separate local evidence package. Final documentation-only changes are
followed by another complete tree/invariant and patch-replay check.

## Historical evidence, not rerun on release46

The previous main8ed integration passed 199 focused tests in 20 files, app/node
TypeScript and focused ESLint. The older 81c integration reported the full
1,209-test quotation suite, local production build and PostgreSQL fresh/forward,
idempotency, ordinary concurrent CAS, ACL and selected SQL-guard checks. Those
results belong to their original trees. **No SQL, CAS, catalog or database
snapshot result is attributed to this release46 composition.**

The original 81c review incorrectly said no network-fence events were recorded;
its summary and raw log contain 18. The later source145 evidence documents that
discrepancy and a minimal TSX-loader IPC reproduction. Historical documents and
source summaries are retained separately; the historical SQL/build results are
not renewed by copying their sources.

## Explicit exclusions

No local or remote database execution, new SQL replay, browser QA, complete
repository suite, new production build, remote CI, remote Git action, publication
or deployment is included. The standalone SQL guard is preserved as source only.
The actual publication base must be checked again before separately authorized
release packaging; this composition is not a released or deployed fix.
