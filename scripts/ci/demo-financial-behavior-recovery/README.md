# Synthetic financial behavior recovery (separate from compile milestone)

This draft preserves the exact source package from PR353 commit `c3a593c94f236aab01c887728c07748eb6912cae` unchanged. Its compile-only acceptance remains in PR353. PR353 was merged by the parent. Its compile-only milestone remains distinct from this behavioral proposal. Main event base was explicitly reviewed at `b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa`: diff from c3a593 contains only the seven PR352 authority-review documentation/test/CI files; baseline, golden infrastructure and all 26 compile package files are identical. No source pins were refreshed.

The new lane first attempts the real `prepare_execute_checkpoint` boundary with synthetic fixtures, then five independent rollback injections after materialization/deferred-guard assertions: checkpoint, marker, execution receipt, event, receipt. The initial workflow used `--suite happy`; the next uses `--suite all`. A strict replay failure remains FAIL, but five independent rollback probes may proceed if materialization assertions plus real deferred guard drain passed and owned cleanup was verified. If that prerequisite fails, probes are NOT_RUN. A probe that fails before its intended injection never counts as a passing rollback.

## Exact inputs and isolation

`source-pins.json` freezes all 26 compile package files and nine original review references from public commit `e8d45165216403478f144f75437fa8c4c6116b5b`. `inputs.json` freezes the complete new package. The exact baseline Git blob is compiled into catalog SHA256 `d61070a66269d27f4a837143d680e40fabc6e9cb8399d37f55d74d801b0fdc86` and validation SHA256 `c81f3809130c28a383935357ef5cf16a6273a676c5157c5efd8d0f00cca23c09`; canonical installers remain byte-identical on disk. The executed laboratory input explicitly substitutes only the manifest variant described below; baseline, engine and triggers are unchanged. The optional proposed retry correction below replaces one private issuer function in the owned lab, preserving the historical source bytes.

Only the exact same-repository draft branch/base/head event can invoke Docker. Golden `scripts/ci/crm-acl-review/run_ci.py` remains byte-identical and pins PG17.6 by digest. Each suite gets a fresh owned container, network none, no ports, no mounts, socket-only database, no DSN. Candidate postgres is NOSUPERUSER/BYPASSRLS/NOINHERIT without supabase_admin membership. Synthetic NOLOGIN service_role membership exists only in the disposable cluster so SET ROLE reaches the actual boundary. It is not a deployed ACL or external identity claim.

Every catalog function is revalidated with check_function_bodies on, fourteen proposed installers are applied unchanged and the manifest installer is the explicit synthetic variant, then the original catalog/body/empty-table verifier runs before fixtures. The fixture includes two synthetic organizations, manual sentinels, sponsor/scheduler/transport owner admissions and authentic producer/issuer context preparation. Financial run/authorization/lineage/checkpoint/receipt rows cannot be manually fabricated as setup.

## Authorized synthetic manifest variant

The canonical `embarques_expediente_formato_valido` constraint only accepts `EL[A-Z]{3}[0-9]+` or `DEMO-[0-9]{4}-[0-9]+`. The proposed immutable manifest expects `SYNTHETIC-SHIPMENT-1/2/3`. New INSERTs remain subject to a NOT VALID constraint. Fixtures therefore use valid synthetic `DEMO-2026-1/2/3` values with truthful snapshots; the actual producer/engine must decide compatibility. The user explicitly authorized a laboratory variant for these three fixture values. `laboratory_manifest()` checks the original source hash, replaces each of the three JSON fields exactly once, and replaces the declared digest with SHA256 of the transformed embedded JSON bytes. It preserves the version and all other bytes. The inverse transformation must reproduce the exact original source; a deep JSON comparison must identify only the three fixture fields. The source/variant installer hashes and JSON-derived identity digest are uploaded in `laboratory-manifest-variant.json`. This variant is not the original manifest and does not change canonical repository files. Runtime phase and SQLSTATE determine any remaining failure.

Happy assertions require a new 13-action/13-receipt materialization, three current approvals, one simulated payment, consistent projection/checkpoint/marker/execution receipt, strict same-context replay, deferred guard drain, full state restoration after ROLLBACK and preserved manual rows. Five injection suites retain exact error matching and snapshot checks. Any unrelated transport/authorization/fixture error remains fatal.

## Evidence and limits

Only public catalog metadata and bounded result JSON are uploaded. Private SQL/stdout/stderr and owned-container tokens remain in runner temp. Every failure records the latest phase plus bounded SQLSTATE diagnostics. Success additionally requires all expected stages and unique assertion/rollback markers, then verified PostgreSQL stop/no PID/client closure/container removal.

Even a passing suite is synthetic assertions followed by ROLLBACK. It does not certify business COMMIT, WAL durability, real authentication, production RLS, HTTP ACK, retry safety or deployed transport. Wire remains UNBOUND, configuration EMPTY, external demo DISABLED. No local SQL execution, real database, secret, persistent grant, deployment or activation is part of this lane.

Offline tests can run with `python -B -I -m unittest discover -s scripts/ci/demo-financial-behavior-recovery -p 'test_*.py' -v`. They do not execute SQL or Docker.

## Runtime evidence ledger

- `8e25beb5ce5903f466e7c254d593e5e281474e38`: [run38822371964](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38822371964) FAIL at strict same-context replay after 13-action materialization assertions. Phase `happy_materialized`, SQLSTATE23514 `DEMO_FINANCIAL_ADOPTION_DENIED`, canonical bridge verifier line79. Owned cleanup verified. Artifact12012827944 ZIP SHA256 `47edda43c07fedc3774d3fb4e72dc8712f44ad32a864c310e9addd513b0b5321`, CRC and four JSON members independently verified.
- The first result is not a passing full happy suite: replay failed and the post-replay guard drain/explicit rollback assertions were not reached. The next harness revision moves the same real guard drain before replay, adds a positive materialization marker and permits independent fault probes only with that evidence and cleanup. The strict replay and aggregate failure are preserved; canonical issuer/bridge remain unchanged.

- `e213a44efb462a2bfa11a848fb6fea8993d6ce14`: [run38822638127](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38822638127) FAIL. Positive materialization marker after authentic deferred guard drain PASS; strict replay still23514. All five fault setups failed before their intended injection with42702 (`target` variable/column ambiguity); none counts as observed injection. Six owned cleanups verified. Artifact12013033050 ZIP SHA256 `49bb5a118870f244f160d9e31f85a8109ed00e62a8eba15087e46483523af286`. Next harness revision qualifies the column and renames the local variable; requires an exact post-catch injection-observed marker in addition to snapshots, assertion/rollback markers and cleanup.

- `8228937643ffed9ba2f910ca8a26d644f6f23823`: [run38823057683](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38823057683) FAIL only on strict same-context retry (23514). Materialization + real deferred guards PASS; all five exact injection/row-snapshot/rollback probes PASS; six owned cleanups verified. Artifact12013104773 ZIP SHA256 `66076d3a2221ff1b6630674f888d8564128249cec3ecb017fd21ed255b90d928`, CRC and four JSON members independently verified.

## Isolated proposed same-context retry correction

The first three runs preserve the original failure. `sql/replay-correction.sql` is a separately inventoried forward proposal, not a historical source edit or deployed migration. `--proposal original` retains the old behavior; the next workflow explicitly selects `--proposal retry-corrected`. Original source bytes and pg_proc.prosrc digest are checked before replacement; owner, INVOKER, language, search_path and corrected body digest are checked afterward. The artifact records source/function/patch/installed-input hashes in `proposed-retry-correction.json`.

The original registry gives an initial context. After its first successful call, the very same context maps to its immutable authorization/run/lineage/receipt. A second call requests the same completed result, not adoption of arbitrary existing invoice IDs and not a new purpose=replay run. The initial bridge correctly refuses pre-existing invoice/concept/payment UUIDs. The proposed issuer incorrectly invoked that first-use guard before looking up the existing context authorization, making the already implemented idempotent checkpoint-return path unreachable.

The new early branch is restricted to initial contexts with an existing authorization. It retains real transport, registry/account/scheduler, expiry and run revocation checks; validates complete context/receipt mapping, authentic preparation origin, payload/source digests, full external-to-typed writer bindings, internal seals, completed materialization/history, execution receipt, checkpoint, projection and current marker. It returns only that same authorization without business writes. No existing authorization still traverses the original anti-adoption bridge. New purpose=replay remains HOLD: no missing origin adapter is invented.

`retry_security` independently proves an unchanged result/rows on legitimate retry, exact initial-bridge and new-context adoption rejections, run revocation and disabled scheduler denial, snapshots around each denial and final rollback. These are synthetic owner-reviewed authority fixtures. A complete happy PASS requires its original replay, explicit rollback assertions and cleanup; materialization alone never grants that label.

## Reviewed base integration

PR354 now targets main at the explicitly reviewed `b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa`. Only this owned functional branch was rebased; no historical source or other worker branch was changed. Source pins remain the original c3a593 package. Prior Actions evidence remains bound to its original heads.

Rebase identity ledger (same three functional patches, new reviewed main parent):

| Historical head | Rebased commit |
| --- | --- |
| 8e25beb5ce5903f466e7c254d593e5e281474e38 | a2e8689685885d55940456d7ce4279214d7197ff |
| e213a44efb462a2bfa11a848fb6fea8993d6ce14 | fd9817fbe255820f83051d0875041bc318b32bfe |
| 8228937643ffed9ba2f910ca8a26d644f6f23823 | 19e3bcd777edfd6532d2107fa63326d638f4ccfd |
