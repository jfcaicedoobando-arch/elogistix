# Atomic acceptance envelope: disposable PostgreSQL 17.6 evidence

This evidence-only workflow is intended for a draft PR on `test/acceptance-envelope-pg176-20261012`. It is not a deployment workflow and is not intended to merge. Root owns all Git writes and any separately authorized remote application.

## Inputs and provenance

- Candidate migration and canonical mirror: SHA256 `cc2d39e7ed1c1999b7ce95a7199209ab204689f4acf11d9091f5e62094c0093d`.
- Original atomic application envelope: SHA256 `65fd583e184f86cc09cee5327d759e12cc97893d66a00baa60668f9ec0ec168b`. `apply_atomic.sql` is byte-identical to the reviewed proposal.
- Previous candidate evidence: PR265 head `674571a3c5b2bd593df17d0549cb5044a3f0730d`, run `38289906617`; PG17.6 artifact `11765420666` and PG17.9 artifact `11764703241` independently verified 135/135 cases each. Those are business tests; they do not prove this new envelope.
- Backend replay: the existing index of 1,528 exact Git blobs from `becc073819df29dfc4bf4619e1deb5be92c0a4be`; index SHA256 `82ba907d535c33216899d10417a37987f44a336fe47d5e8cab789a60025effcd`.
- Admission records actual PR base/head and requires exact same repository, head checkout, evidence branch, source blobs and merged candidate bytes. It does not assume main will remain at the branch-creation commit `e8bdf0b179ef1d6efbc94ef04bcd87c8bac856c1`.

## Isolation and the only envelope adaptation

Official image pinned to `postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`; server must return `170006`. One owned container, network none, no published ports or host binds, read-only root, nonroot postgres, dropped capabilities, tmpfs, clean process environment and no inherited credentials. Database/current_user/session_user are all `postgres`, as required by the original envelope. Only exact allowlisted replay sources are copied into the container. The candidate migration is deliberately absent from the replay directory and is applied only by the envelope.

The original OID guard `v_before.oid <> 100911` is replaced once by the verified local OID. The original and adapted SQL and hashes are archived; reversing this exact literal substitution must reproduce the original envelope. No timeout, version, session, database, source, definition, ACL, owner, payload, guard, postcondition or transaction boundary is changed. The separate readback's OID comparison is likewise mapped to the same recorded local OID and its SELECT wrapped in row_to_json solely for assertion.

Historical repository platform bootstrap is retained for replay. No business RPC is called, no success mock stands in for DDL, and `_ci_post_migrate.sql` is never copied or executed. Real application ACL, RLS and 13 validated auth.users foreign keys remain intact. The empty ledger fixture reproduces observed columns, PK(version), UNIQUE(idempotency_key), postgres ownership, default ACL and disabled RLS. The metadata source records zero ledger triggers/rules/policies and six Supabase platform event triggers. Those live platform event triggers are documented, not reproduced in vanilla PostgreSQL; this is an explicit platform limit.

## Eighteen ordered SQL cases

1. Original live OID guard rejects this distinct fixture OID.
2. The same envelope in a separate owned clone with the wrong database name rejects its identity guard; both clone and source snapshots remain unchanged.
3. Same envelope transmitted under wrong client encoding rejects the payload hash.
4. Source drift rejects before DDL.
5. Withdrawn service_role EXECUTE rejects before DDL.
6. SECURITY INVOKER drift rejects before DDL.
7. Owner drift to a synthetic NOLOGIN role rejects before DDL.
8. Search-path configuration drift rejects before DDL.
9. Preexisting migration version with incompatible contents is preserved and rejected.
10. Ledger BEFORE INSERT hook verifies exact candidate body, then fails: DDL rolls back.
11. Ledger hook suppresses INSERT: original ledger postcondition fails and DDL rolls back.
12. Deferred ledger constraint trigger verifies exact candidate and inserted SQL, then fails at COMMIT: both roll back.
13. Event-trigger fixture changes function COST after CREATE FUNCTION: original metadata postcondition rejects and rolls back.
14. Another real session holds the exact advisory lock: wait and SQLSTATE 55P03, then no state change.
15. Another real session holds the ledger lock: wait and SQLSTATE 55P03, then no state change.
16. Same exact adapted envelope succeeds after holders roll back; only target prosrc and one exact ledger row change.
17. Separate-connection readback verifies source, OID/access, version, ledger name/count/hash. Full ledger array equality is additionally checked by the installed snapshot; a separate query requires cardinality=1, dimensions=1, lower=1, upper=1 and SHA256 of statements[1]. Nothing is inferred from concatenated hash alone.
18. Repeating the committed envelope rejects existing ledger and preserves the successful state exactly.

Failure injection modifies only disposable fixtures around the original envelope. BEFORE/AFTER snapshots compare all public/auth functions, relations, constraints, policies, attributes, trigger/namespace/role metadata, plus the ledger schema and event triggers. Every public/auth/storage table is inventoried and its complete ordered rows hashed; the ledger is captured in full. Only six known physical vacuum counters/horizons are excluded from catalog comparison; ACL, RLS and relhastriggers are not excluded. Explicit VACUUM after removing ledger test triggers cleans their lazy physical hint before final restoration comparison.

Blocker proofs record the actual session/application/database/PID, granted holder lock, waiting lock, pg_blocking_pids and SQLSTATE. Success cannot be inferred merely from elapsed time. Both holders are explicitly rolled back. Final PASS requires owned container removal and a failed inspection proving its absence.

## Evidence and limits

`run.json`, source TAR, original/adapted envelope, all executed SQL/stdout/stderr, catalog/row/ledger snapshots, lock observations, readback and cleanup logs are uploaded even on failure. The ten offline Python checks are separate from eighteen actual SQL cases. Until CI runs and its artifact is reviewed, SQL is **not executed / not passed**.

This verifies isolated application atomicity and fail-closed guards. It does not invoke acceptance/conversion again, issue fiscal documents, call PAC, prove live business data equivalence, or perform a remote migration/deployment. Advisory locking remains cooperative: unrelated DDL writers require external coordination. Remote ledger hooks must be checked before application; an isolated fixture cannot establish their absence. An uncertain remote result requires separate readback, never a blind retry.
