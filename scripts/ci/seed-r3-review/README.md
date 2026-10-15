# Ledger integration revision — local, runtime NOT_RUN

The current local revision adds the reviewed ledger wrapper, import-safe LAB-only renderer, and 13-case ledger harness. 80 offline unit tests and additional renderer security assertions pass; no SQL/Docker runtime has been executed for this revision. Overall PASS requires exact ledger-case completion and confirmed owned-container cleanup before finalization. See `README_LEDGER_CASES.md` for case mapping, sequence-gap semantics, and uncovered transport/concurrency cases. The CLI is prepared for the strictly gated Actions lane; no local runtime was executed. Historical validation claims below refer to their explicitly identified prior revisions, not this ledger revision.

# R3 review-only proposal

**NO APLICADO / NOT APPLIED.** This directory is an inert review artifact, not a migration entrypoint. Do not move its SQL into an automatically applied migration/schema directory. Importing the read-only contract test does not start PostgreSQL, execute SQL or install software. Nothing here authorizes deployment, ledger registration, production execution or a claim of full R3 validation.

## Files and provenance

- `PROPOSAL_R3_rename_lock_admission.sql`: exact R3 candidate, SHA-256 `7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86`.
- `run_isolated.py`: unchanged disposable multi-session-capable regression harness, SHA-256 `93ac69a3d0ae3cccbb9587ffdf07ba5751b99928d5a0ff8a4e747162731fa9f9`.
- `fixtures/R2.sql`: exact reviewed R2 comparator. Its known terminal early-return defect is intentionally retained.
- `fixtures/TEST_ONLY_initial_functions.sql`: exact historical definitions. These are installed only into a fresh isolated fixture database; historical function bodies must never be invoked.
- `fixtures/dependencies.sql`, `fixtures/event_drift.sql`, `snapshot.sql`: unchanged dependency, eighth-rename event drift and snapshot fixtures.
- `provenance-sha256.json`: fixed source hashes copied from prior artifact provenance; tests compare against independent literal expected hashes. No check regenerates this file to make itself pass.
- `contract.test.ts`: Node-only, read-only Vitest contract for hashes, common final gate placement, harness isolation/cleanup and evidence labels. It does not claim SQL semantic validation.
- `verify_static.py`: Python standard-library-only read-only verification; no PostgreSQL or npm dependencies.
- `supplementary-result.json`: sanitized summary of an earlier supplementary single-user run, without private output paths or full logs. This package did not generate that runtime result.

Original artifacts are preserved outside this package. Fixture bodies contain historical demo contact literals that are part of their reviewed hashes; they have not been reprinted in reports or altered to create a misleading hash-equivalent fixture. No credentials, database endpoints, binaries, database clusters or full execution logs are included.

## What R3 changes

R2's terminal-state early return bypassed its common final postcheck. R3 instead conditionally skips the four stopped-body replacements and their intermediate postchecks, then makes both historical and terminal paths pass the common final event/extension and complete-function metadata/hash gate. All original preflight, lock, ownership, ACL and intermediate guards remain byte-for-byte in the reviewed candidate.

Rename locks serialize the four existing function objects within the admission transaction. A terminal retry is logically idempotent but not a physical no-op: the eight renames write tuple versions, so xmin/ctid can change. Admission does not invoke historical business seed bodies or register a migration ledger entry.

## Validation status

- Static Python AST/hash/structure checks: runnable with the command below; preparation checks passed. Static success is not a runtime pass.
- Vitest contract: **6/6 local checks passed** in one test file, using already installed Vitest 5.0.2, isolated Node configuration and `--no-cache`. No dependencies were installed. This read-only static contract run is not repository-wide typecheck, the repository-pinned Vitest 5.0.3 run, CI success or database execution.
- Original Docker event-trigger matrix: **10 checks passed** remotely on PR #340 at commit `ac5bb699`, using PostgreSQL 17.6 postmaster with confirmed owned-container cleanup. That result covers the original eight event-trigger cases plus transition/retry and dependency checks, not the new concurrency integration or production execution.
- Two-session concurrency: the first integrated Actions attempt failed in transport framing: Docker delivered an XX000 marker before its primary error; this did not establish the writer-preservation assertion. The corrected revision is **NOT_RUN** at runtime. `concurrency_cases.py` is now integrated locally through `Runner.psqlctl` and invoked explicitly after the original matrix, before PASS. The combined adapter/concurrency/terminal offline suite passes **64 tests**, including local synthetic pipe-order validation without Docker or SQL; real execution of this updated revision in Actions remains pending. Historical active-call case P1 remains omitted.
- Terminal direct calls: **NOT_RUN** at runtime. The reviewed terminal module is integrated after concurrency and before PASS. It verifies terminal hashes before five direct invocations across four routes, including both guarded cooldown variants, while another synthetic backend holds the historical advisory lock. Exact 55000 diagnostics and unchanged tracked/auth/inventory snapshots are required. No historical seed routine is invoked.
- Supplementary PostgreSQL 17.6 `--single` evidence: five checks passed previously: non-bootstrap operator/negative privileges; historical definition hashes without invocation; explicit-transaction rollback; four stopped hashes with OID/ACL/other observed metadata preservation; sequential terminal retry with logical equality and physical tuple changes.
- `--single` disables event triggers. Event-trigger regression and concurrent-session checks were **NOT RUN** in that evidence. It is not production-equivalent. Server/client binaries were reported as 17.6 and system libpq as 17.11, not an entirely 17.6 dependency stack.

## Read-only commands

From the repository root:

```sh
python3 -I scripts/ci/seed-r3-review/verify_static.py
python3 -I -m unittest discover -s scripts/ci/seed-r3-review -p 'test_*.py' -v
bun run test -- scripts/ci/seed-r3-review/contract.test.ts --project=node
```

The Vitest command uses only the repository's already installed dependencies. Do not fetch a new npm toolchain just to run this check. The current repository `scripts/lib/testEnvSplit.ts` discovers tests in `scripts/` and honors `@vitest-environment node`; this test follows that contract. These commands are not database tests.

## Draft-only CI lane (concurrency update prepared locally; runtime pending)

The independent `.github/workflows/seed-r3-review.yml` lane is limited to a same-repository draft PR from `fix/seed-r3-ledger-review-20261015` into `main`, with base SHA `c935c2593dfd725edb3c30dcab9bd6f0439ff71b`. The reviewed current base tree is `8a54483cba5aa3b8d34086dcf11b6bc7c4e63945`; historical source provenance below remains pinned to its original commit. A changed base requires a fresh review; it is not silently accepted. The lane does not activate through this document or a local static check.

`review-contract.json` records the boundaries. `run_ci.py` uses host Python and Docker with the pinned image `postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`, requiring PostgreSQL `server_version_num=170006`. Before container creation, it verifies immutable source hashes and exact equivalence of its copied matrix to the hash-locked original harness block. SQL goes through stdin to `docker exec -i psql` over the owned private UNIX socket. It does not require Python inside the PostgreSQL image.

The original matrix covers eight R2/R3 × historical/terminal × COST/prosrc event-trigger cases, plus clean historical transition/terminal retry and existing view/trigger-bridge dependencies. Those same-transaction event-trigger cases do not constitute two-session concurrency testing. The locally integrated concurrency module adds four explicit cases: prior COST writer commit, prior COST writer rollback, held R3 rollback with four blocked COST routes and unrelated DDL, and queued non-CASCADE DROP exposing the postcommit limitation. These four cases still require a real Actions run for this updated revision; offline mocks do not establish runtime coverage.

Persistent clients revalidate the owned container and PostgreSQL 17.6 non-superuser identity, use SQL on stdin and merge diagnostics/output inside the container before Docker multiplexing, through a constant positional-argument wrapper, and are independently registered for outer cleanup. The adapter reaps only those registered children before owned-cluster shutdown, including after a concurrency-module exception. It verifies identity before cleanup, checks shutdown and PID absence, removes the owned container and verifies absence before PASS. The workflow has an always-run cleanup step and bounded diagnostic artifact retention. `test_ci_adapter.py` is an offline mock suite, not evidence that Docker or the PostgreSQL matrix ran. There is no production migration or deployment step.

## Git provenance of preserved SQL bytes

Source files below were read directly from `jfcaicedoobando-arch/elogistix` at reviewed base `e383238caf130455b2991184d0cae0c29a627aca`; provenance is not based solely on an archive. All paths are under `supabase/migrations/` in that repository. No historical migration was executed to establish these comparisons.

- All four stopped function bodies embedded in R2 and R3 match `20261015050000_disable_demo_reseed.sql` exactly (Git blob `4a8959747139d32e01b63a1f7751bc9356000e79`, file SHA-256 `5b304e234c836f9ebb0e9ebc508139e976f67ba0d765cb6537ad5d320991a278`).
- Historical core: `20260728062322_74f85865-2e77-4ca8-9fa8-69fded9da54b.sql` (blob `f879c63006a32347eea87957d6d89f7955d8ff31`), the rename in `20260729071258_b13068dd-e4bf-429f-9edb-24c583473ded.sql` (blob `8884664971fa5fe51cea04aa16a79f7084dfba2f`), and six text substitutions from `20260831202634_863f9bd0-d217-417c-841a-4e4303193907.sql` (blob `906429367abe4e501df239aa0fb3d5b53deb3a1b`) reproduce the fixture body exactly, SHA-256 `27416fdd4b66ab7fb50893e90b4640a532f742955b181c18aa5e9a2d96ee8331`. Only text transformations were performed for this verification.
- Historical cleanup and wrapper bodies match `20260827224436_426fa39b-ab98-40b6-b31d-89ce1b2b660f.sql` exactly (blob `ab83ce68ed291deebeb406172734d7b7dc4ec1a7`).
- Historical guarded body matches `20261013204000_replay_demo_seed_limpia_agentes.sql` exactly (blob `bdda97d66e2ed234319a72aa584348cb01b984df`).

Contact and fiscal literals in the preserved bodies already occur in the same repository's seed-demo sources. Source comments identify seed-exclusive keys and demo data. Values are not repeated in this documentation or the sanitized result. The review found no credentials or personal tax identifiers; matching 13-character shipment literals were not RFC fields. This establishes source provenance and demo context, not universal proof that every corporate identifier, domain or telephone number is nonexistent. No external investigation of people or domains was performed.

## Explicit opt-in disposable runtime, not part of the Vitest test

The unchanged harness can be run separately after review/authorization, as an unprivileged OS user, using already installed local PostgreSQL 17.6 binaries and a new output directory:

```sh
python3 scripts/ci/seed-r3-review/run_isolated.py \
  --pg-bin /path/to/postgresql-17.6/bin \
  --r3 scripts/ci/seed-r3-review/PROPOSAL_R3_rename_lock_admission.sql \
  --output /path/to/new-results-directory \
  --run-disposable-only
```

Optional `--pg-share` and `--pg-lib` accept existing local directories; they do not rewrite compiled `$libdir` paths. The harness does not obtain binaries, accept a DSN or external host/socket/cluster, or connect to an existing database. It refuses root, requires the explicit disposable flag, creates a private temporary cluster/socket, disables TCP, rejects host authentication, constructs a clean environment, uses `psql -X`, and verifies version/identity/negative privileges. The operator is NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS and not an administrator member. A separate cluster administrator owns the event fixture.

Startup attempts are recorded before pg_ctl. Finally cleanup checks and stops only that invocation's data directory. Shutdown and absence of the PID file are verified before removal. Failed/unconfirmed cleanup preserves the directory and fails. PASS is emitted only after successful checks and confirmed removal. Timeouts retain diagnostic output. Never substitute real credentials or relax these guards to make a run pass.

## Expected regression matrix and boundaries

For COST and prosrc mutation on the eighth tracked rename:

- R2 terminal: reproduce the defect (unexpected admission success with retained drift).
- R3 terminal: exact primary P0001 `admission_terminal` postcheck failure and full observed rollback.
- R2/R3 historical: exact primary P0001 `admission_0` postcheck failure and full observed rollback.
- Unarmed R3 historical: four exact stopped hashes installed, original OIDs/ACL and other checked metadata preserved.
- Unarmed R3 terminal retry: logical equality with changed physical tuples.
- Existing view OID dependency and RETURNS-trigger bridge: verified dependencies and fail-closed calls only after stopped hashes are established.

The mutation event is same-transaction DDL, not a concurrent session overriding a held lock. This harness does not establish concurrency safety merely by using a normal PostgreSQL server. The bridge's textual PL/pgSQL reference is not claimed to be a pg_depend edge.

Rollback snapshots cover public/fixture function rows and physical identities, event triggers and physical identities, extensions, global pg_depend/pg_trigger/pg_rewrite, roles, fixture control, ledger, marker and bridge rows. Equality proves only this observed scope, not every database object or external side effect.

Future privileged owner DDL, event-trigger implementation changes that preserve event catalog rows, arbitrary transitive dependencies, active historical calls, prepared plans, drains and registration protocols remain outside this evidence. R3 does not fix or validate that broader mutation matrix. Production admission requires separate review and evidence.
