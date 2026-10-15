# Synthetic financial behavior recovery (separate from compile milestone)

This stacked draft uses PR353 commit `c3a593c94f236aab01c887728c07748eb6912cae` unchanged. Its compile-only acceptance remains in PR353. This experiment does not broaden that acceptance.

The new lane first attempts the real `prepare_execute_checkpoint` boundary with synthetic fixtures, then (only after a passing happy prerequisite) five rollback injections: checkpoint, marker, execution receipt, event, receipt. `--suite happy` is the initial workflow. All suites exist as executable fixtures; a suite that cannot reach its injection is NOT_RUN, never a passing rollback.

## Exact inputs and isolation

`source-pins.json` freezes all 26 compile package files and nine original review references from public commit `e8d45165216403478f144f75437fa8c4c6116b5b`. `inputs.json` freezes the complete new package. The exact baseline Git blob is compiled into catalog SHA256 `d61070a66269d27f4a837143d680e40fabc6e9cb8399d37f55d74d801b0fdc86` and validation SHA256 `c81f3809130c28a383935357ef5cf16a6273a676c5157c5efd8d0f00cca23c09`; canonical installers remain byte-identical on disk. The executed laboratory input explicitly substitutes only the manifest variant described below; baseline, engine, triggers and issuer are unchanged.

Only the exact same-repository draft branch/base/head event can invoke Docker. Golden `scripts/ci/crm-acl-review/run_ci.py` remains byte-identical and pins PG17.6 by digest. Each suite gets a fresh owned container, network none, no ports, no mounts, socket-only database, no DSN. Candidate postgres is NOSUPERUSER/BYPASSRLS/NOINHERIT without supabase_admin membership. Synthetic NOLOGIN service_role membership exists only in the disposable cluster so SET ROLE reaches the actual boundary. It is not a deployed ACL or external identity claim.

Every catalog function is revalidated with check_function_bodies on, fourteen proposed installers are applied unchanged and the manifest installer is the explicit synthetic variant, then the original catalog/body/empty-table verifier runs before fixtures. The fixture includes two synthetic organizations, manual sentinels, sponsor/scheduler/transport owner admissions and authentic producer/issuer context preparation. Financial run/authorization/lineage/checkpoint/receipt rows cannot be manually fabricated as setup.

## Authorized synthetic manifest variant

The canonical `embarques_expediente_formato_valido` constraint only accepts `EL[A-Z]{3}[0-9]+` or `DEMO-[0-9]{4}-[0-9]+`. The proposed immutable manifest expects `SYNTHETIC-SHIPMENT-1/2/3`. New INSERTs remain subject to a NOT VALID constraint. Fixtures therefore use valid synthetic `DEMO-2026-1/2/3` values with truthful snapshots; the actual producer/engine must decide compatibility. The user explicitly authorized a laboratory variant for these three fixture values. `laboratory_manifest()` checks the original source hash, replaces each of the three JSON fields exactly once, and replaces the declared digest with SHA256 of the transformed embedded JSON bytes. It preserves the version and all other bytes. The inverse transformation must reproduce the exact original source; a deep JSON comparison must identify only the three fixture fields. The source/variant installer hashes and JSON-derived identity digest are uploaded in `laboratory-manifest-variant.json`. This variant is not the original manifest and does not change canonical repository files. Runtime phase and SQLSTATE determine any remaining failure.

Happy assertions require a new 13-action/13-receipt materialization, three current approvals, one simulated payment, consistent projection/checkpoint/marker/execution receipt, strict same-context replay, deferred guard drain, full state restoration after ROLLBACK and preserved manual rows. Five injection suites retain exact error matching and snapshot checks. Any unrelated transport/authorization/fixture error remains fatal.

## Evidence and limits

Only public catalog metadata and bounded result JSON are uploaded. Private SQL/stdout/stderr and owned-container tokens remain in runner temp. Every failure records the latest phase plus bounded SQLSTATE diagnostics. Success additionally requires all expected stages and unique assertion/rollback markers, then verified PostgreSQL stop/no PID/client closure/container removal.

Even a passing suite is synthetic assertions followed by ROLLBACK. It does not certify business COMMIT, WAL durability, real authentication, production RLS, HTTP ACK, retry safety or deployed transport. Wire remains UNBOUND, configuration EMPTY, external demo DISABLED. No local SQL execution, real database, secret, persistent grant, deployment or activation is part of this lane.

Offline tests can run with `python -B -I -m unittest discover -s scripts/ci/demo-financial-behavior-recovery -p 'test_*.py' -v`. They do not execute SQL or Docker.
