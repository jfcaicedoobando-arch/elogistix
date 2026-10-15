# Isolated R3 + Drizzle laboratory subset

Status: implemented and offline-checked; PostgreSQL/Docker runtime NOT_RUN.
No production SQL, Git, Lovable, migration execution or Docker operations were performed while preparing this package.

## Integration

Copy `ledger_cases.py` and `test_ledger_cases.py` beside the frozen R3 runner, its R3 SQL, the reviewed fenced wrapper, expected-drizzle-preimage.json and import-safe render_lab_candidate.py. Run `run_ledger_cases(runner, controls, renderer)` after the unchanged baseline matrix, with controls referring to the frozen concurrency_cases module. The postgres template must remain historical. Each case uses its own qa_r3_cc_ledger_* database cloned from that template, the existing owned-container psqlctl gate, and two verified persistent sessions.

The module does not start Docker, accepts no DSN and performs no action at import. It writes only evidence under runner.output when explicitly called. Existing case_sessions closes/reaps clients, terminates and verifies absent owned database backends, then drops the case database. It records `checks_pass_cleanup_pending`; it never uses runner.check to emit premature success. After successful outer owned-container shutdown/removal call `finalize_ledger_result(runner.result)`, which requires the exact 13-case manifest, every case database cleanup, pg_status_3_and_no_pid, owned_psql_clients_closed and confirmed_stopped_and_removed. It cannot promote empty/partial manifests.

## Runtime cases programmed, all NOT_RUN here

- clean: L01 historical-to-stopped and L02 complete clean retry
- adopt: L03 already stopped without registration, then retry
- version_collision: L04 same when, different hash
- hash_collision_older / hash_collision_newer: L05 same hash, different when on either side
- registered_historical: L06 exact migration identity with historical bodies must abort
- duplicate_identity: L07 duplicate exact migration identity must abort
- metadata_drift: partial L12 mismatch of captured metadata (RLS changed)
- insert_fault: L08 four exact stopped hashes observed by an explicit TEST_ONLY CHECK constraint before a unique primary error; after rollback all four historical bodies and full transactional witness must match
- trigger: partial L12 immediate trigger rejection
- deferred_trigger / deferred_outer: L19 deferred constraint trigger rejected even when its metadata was included, both autocommit and an explicit outer transaction
- supabase_drift: changed Supabase digest must reject without mutation

The CHECK fault is installed NOT VALID after historical ledger data, so it applies to the future INSERT without evaluating old rows. The renderer records its measured metadata explicitly. It does not disable trigger guards, run historical business routines, change the canonical payload or alter the production proposal. Its non-secret body hash map verifies all four Fs and only raises an error. Its primary P0001 diagnostic proves arrival at INSERT after replacement; preflight permission rejection would not satisfy the test.

## Witness and serial gap

The witness combines the original R3 snapshot (full pg_proc including xmin/ctid, events/extensions/dependencies/roles/triggers/rewrite, Supabase rows and business sentinels) with full Drizzle rows, candidate metadata, detailed defaults/triggers/functions/constraints, sequence relation/ACL, Supabase relation metadata, and server-side ordered Supabase digest. Every target OID is explicitly resolved using its public signature. Successful transition checks all function metadata/OIDs/ACL through the frozen verifier; retry normalizes xmin/ctid only for the four resolved target OIDs, never same-named unrelated functions.

Sequence state is retained separately. PostgreSQL nextval is nontransactional: L08 expects an observed sequence advance despite rolled-back function and ledger writes. The harness excludes only sequence state from exact rollback equality. A serial gap is not a committed migration, duplicate, or reason to repair a sequence. Clean retry must not advance the sequence.

The laboratory identity is TEST_ONLY when=1900000000000, tag=LAB_ONLY_NOT_A_MIGRATION. Canonical R3 hash remains the identity hash; rendered wrapper SHA is evidence, not that identity. Real parent metadata/OIDs/digests are replaced by local measured fixture values. No credential or live DSN is included.

## Explicit limitations

L02 injected terminal COST/prosrc drift is not repeated in this ledger subset; the frozen R3 matrix covers its own terminal path only. L07 adversarial multiset coverage beyond duplicate M and L12 other context/shape failures remain unrun. L09-L11 post-INSERT mutations are not admitted by this strict trigger-free wrapper and are not claimed as runtime coverage. L13-L18 ledger concurrency, noncooperating pre-read applier, cancellation/transport loss and auto-registration are NOT_RUN. psql does not establish the remote transport contract, and laboratory exclusivity does not establish production applier exclusion. Passing this subset cannot certify all 19 plan cases or production readiness.

## Offline verification

`python -m unittest -v test_ledger_cases.py`: 12 tests passed. They cover inert import, exact history and metadata, sequence-gap-only rollback, exact target-OID retry normalization, cleanup failure and missing-case fail-closed behavior, fault structure, deferred trigger shape and absence of a process/remote connection API. A separate no-SQL smoke import/render verified current renderer accepts qa_r3_cc_ledger_clean and binds the synthetic timestamp and tag. These checks are Python/static evidence only, never PostgreSQL execution evidence.
