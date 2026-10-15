# Sanitized demo-flow review sources

**HOLD. Review only. Not an installer, migration, enabled endpoint or runtime acceptance.**
All files belong under `docs/review/demo-flow-20261015/`, outside active migrations,
functions, routes and workflow discovery. Do not execute the SQL against a real database.
No credential, DSN, customer record, production configuration, policy registration,
control activation or deployment is included.

## Scope and source transformations

- SQL contains the private writer, issuer/registry, identity helper, bridge and producer
  proposals. `review-order.json` is dependency reading order only. Required catalog,
  business tables, roles, normalization implementation and ACL state are not supplied.
- The historical organization identifier was replaced throughout by the explicit
  synthetic tenant `00000000-0000-4000-8000-000000000001`.
- Identity/customer/contact labels and all financial labels use a new synthetic
  catalog. Emails use `example.invalid`; telephone and tax identifiers are empty.
  `fixtures/manifest.json` mirrors the compact JSON embedded in `sql/02-manifest.sql`;
  its declared manifest checksum hashes that exact compact UTF-8 JSON.
- These substitutions change fixture payloads and checksums. This export is not
  byte-identical to the historical data or evidence of equivalent historical data.
  Existing fixture keys, financial amounts and authorization/control logic remain
  for review. No assertion that historical contacts were fictitious is made.
- The original historical seed body, unrelated migration history, agent instructions,
  internal reports, workspace metadata, runtime doubles and generated logs are omitted.
- The approval helper and its source-body pin are retained for comparison; the engine
  file pin is recomputed for the sanitized copy. Hashes provide integrity, not authority.

## RPC corrections

`rpc/rpc-attempt.ts` rejects non-string context IDs and scopes before transport.
Checkpoint timestamps use a strict finite ISO/PostgreSQL JSON contract: AD years
0001–9999, a valid calendar date, T separator, hh:mm:ss, optional 1–6 fractional
digits, and Z or ±hh:mm[:ss] offset (up to 15:59:59). Unsupported infinity, BC or
expanded years, leap seconds, 24:00 and timezone-less forms fail closed. The exact
validated timestamp is preserved, including microseconds and offsets.

The tests exercise execute and reconciliation, invalid calendar dates and scalar/
array coercion. They use protocol doubles. An outcome named `committed` in these
tests is not proof of an actual database or HTTP commit.

## Reproducible offline checks

Run from this directory with Python 3 and Node 24:

    python3 -I verify_manifest.py
    python3 -I run_offline.py

If an already-installed TypeScript compiler is available:

    tsc --strict --noEmit --target ES2022 --module ESNext --moduleResolution Bundler rpc/rpc-attempt.ts

`run_offline.py` does not install dependencies, contact services, run SQL or rewrite
tracked evidence. SQL source assertions are textual only. PostgreSQL, HTTP commit/ACK,
financial behavior, actual ACLs, multi-session races and full integration are NOT_RUN.
The separate synthetic runtime harness is not bundled or certified here.

## Remaining blockers

Process-local Sets are only supplemental duplicate-call guards. Durable one-dispatch
admission outside a rollbackable transaction, recovery-only restart, authenticated
transport, no transparent client/proxy retry, and genuine PostgreSQL/HTTP behavioral
acceptance remain separate gates. Registries stay empty; no source copy activates them.

## Integrity

`manifest.json` includes every deliverable except itself, with relative local and
repository paths, SHA-256 and Git blob SHA-1 (computed as `blob <length>\0` + bytes).
`verify_manifest.py` rejects unlisted files or altered bytes. The manifest is intentionally
not self-hashed. Regenerate it only for an intentionally reviewed new version.
