# CRM helper ACL canonical forward (proposal)

Base: main `70a55d4e29784fb1a78ed74f164473153bead704`. Append `0021_crm_helpers_owner_only` after 0020 and its exact Supabase mirror `20261015194324_crm_helpers_owner_only.sql`. Timestamp is a new source identity, not a claim that anything was applied. No historical SQL, H6 exception, existing ACL preservation allowlist, or 0016/0018 behavior is rewritten.

0017 leaves the installation's existing/default service_role grant in place. 0018 changes cargo columns and does not repair that ACL. This forward performs exactly two REVOKE EXECUTE ... FROM service_role RESTRICT commands; it grants nothing and never recreates a function or trigger. Already owner-only installations are accepted, but both REVOKEs still run. Unexpected roles, grants with grant option, foreign owners, source/config changes, inherited/partitioned CRM tables or extra/helper trigger links reject.

The SQL is one atomic DO statement. The runner must establish statement_timeout before starting that DO (for example, SET LOCAL in an already-open transaction). The internal set_config(statement_timeout) is not a guarantee that this already-running DO will stop after 20 seconds. The Drizzle/Supabase runner owns transaction and registration. Runtime identities are resolved by qualified signatures; source-body SHA256 values derive from the immutable 0017 source. A coherent pg_proc snapshot is validated before becoming the comparison baseline. Trigger baseline is likewise validated from the captured snapshot, not a later query. Stable pg_proc fields, helper links, comments, security labels and pg_depend links must compare equal after both revokes. This is scoped preservation, not a universal catalog proof. No hardcoded instance identities, physical tuple IDs or broad catalog locks are used.

## Public canonical vs private operational envelope

The canonical migration is portable; its precondition checks the source contract and expected semantic metadata. It does not prove that the current named objects are the same installation objects seen in an earlier approval. That is the separate private envelope's responsibility.

Before a real application, independently capture and review fresh target-specific function identities, full semantic metadata/ACL, trigger links, relation identities, ledger rows and ledger metadata, active event triggers/functions, queued appliers/prepared transactions and exact canonical bytes. Keep this capture private and never include it in a repository, Actions artifact or workflow input. Retain the operational DDL/ACL window until postflight. The old instance-bound candidate is not a substitute for the new canonical ledger identity and must not be applied as a second migration.

F2 remains an observed limit: concurrent transient grant-option normalization can be observationally equivalent to the approved result. Neither advisory locks, REVOKE row locking nor pre/post snapshots certify immunity. Cooperative locks are only cooperative. The private window must exclude relevant owner DDL/ACL writers; unexpected contention/drift fails closed. No production readiness follows from fixture success.

## Prospective direct-Lovable transaction and ledger route

Do not execute the fenced template. It is intentionally incomplete and must not be added to a migration journal.

1. Verify the actual transport is direct SQL with no automatic Drizzle/Supabase registration. If it auto-registers, use that runner's documented transaction/ledger mechanism instead; never mix manual and automatic registration.
2. Freeze exact canonical SHA256, tag, journal `when` and ordered complete existing histories. Confirm main/history still ends at the expected predecessor, without duplicate hashes/timestamps or conflicting versions. Do not reserve a guessed Supabase ledger version.
3. Build a private, independently reviewed single top-level DO wrapper. Lock only the existing Drizzle ledger in SHARE ROW EXCLUSIVE NOWAIT and the relevant existing objects, in a reviewed common order. Validate complete private preimages, ledger owner/schema/constraints/indexes/defaults/triggers/rules/policies/sequence metadata, event-trigger functions and permission context; do not grant access or create ledgers.
4. Execute the exact canonical DO text in that same transaction, checking its hash before EXECUTE. Do not reconstruct or substitute a weakened production payload. Revalidate the private identity/catalog envelope after execution.
5. Insert exactly one canonical hash/when row if absent, using the verified existing registration convention. Explicitly review sequence behavior: nextval is not transactional; an arbitrary explicit id can desynchronize future inserts. A renderer must resolve this from fresh actual schema and the adopted convention, not guess it. Already registered exact row must be verified, not blindly skipped; partial, conflicting or future history rejects.
6. Assert the exact expected Drizzle row delta and all prior row/metadata preservation, plus an unchanged Supabase ledger for the manual direct route. The Supabase mirror is for portable replay; its existence does not authorize fabricating a Supabase ledger entry on the direct path. Commit only if all checks pass, with no exception-swallowing path.
7. After an uncertain response, read both ledgers and the complete target postcondition under the maintained window. Do not blindly resend. Verify final catalog identity/source/config/ACL and both ledgers independently before closing the window.

The wrapper is not yet admitted: fresh private target contract, actual transport proof, sequence convention, runtime rollback/idempotency tests and independent review are prerequisites. This deliverable does not claim a real application, reservation or registration.

## Actions replay plan (NOT RUN)

Use the isolated PG17.6 pinned-image/non-superuser/network-none harness from the reviewed CRM lane, on an exact frozen draft same-repository commit, with no credentials/DSNs/private contract. Add a separate canonical lane; do not relabel the previous instance-fixture result as canonical coverage.

- Fresh replay: repository bootstrap/default privileges and complete ordered Supabase history through the new mirror, including 0016/0017/0018/0020 dependencies. Assert service grant exists after 0017 where defaults grant it, and is absent only after 0021. Record all prerequisite failures without replacing full replay by a miniature fixture.
- Upgrade: replay exact parent history, capture the full scoped semantic catalog, apply the exact new source, compare only the two permitted ACL removals. Preserve helper sources/config/owners/OIDs, every trigger link, 0016's function and ACL, 0018 columns/defaults and all unrelated named metadata.
- Idempotency: run canonical source again after owner-only state; no new ACL or catalog drift. Exercise a transactional synthetic manual ledger wrapper separately with zero/one/conflicting entries, concurrent appliers and lost-response verification.
- Reject source/config/owner/signature/extra-role/grant-option/extra-trigger/partition/inheritance drift. Include both helpers independently and source hash tampering.
- Reuse observed-lock concurrency cases, owner-only replay, full-snapshot c09/c12 regression assertions, strict competitor error classification, interruption/rollback and cleanup proof. Report F2 limits explicitly; do not transform them into PASS.
- Confirm actual SQL/PLpgSQL syntax, JSON catalog representations and atomic rollback in PG17.6. Offline string/manifest tests do not prove these.
- Run normal repository migration/replay/release audits and tests on the exact integrated commit. Existing replay mapping and ACL-preservation guards require no exemptions for this pure-REVOKE forward. The added focused tests exercise their actual implementations.

## Validation status

Offline: 13 Python source/manifest contracts PASS and 3 Bun existing-guard tests PASS. SQL, Docker, full clean replay, integration concurrency and real database application: NOT RUN. No Git mutation or private contract export performed.
