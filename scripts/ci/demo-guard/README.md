# Demo release: historical positives and final disabled state

These runners prepare isolated Actions checks. They do not authorize deployment,
database migration or execution against any real database. Offline tests simulate
transport and lifecycle; a pass is not a PostgreSQL runtime certification.

## One historical checkpoint before the forward

`rls-prepare-db.sh`, with the mandatory workflow flags and exact
`${{ job.services.postgres.id }}`, calls `run-prefreeze-actions.py` exactly once
immediately before `20261015050000_disable_demo_reseed.sql`. It captures the
current replay database into one random, owned checkpoint database. It never
replays older history or reinstalls old functions on source `postgres`.

The runner pins SHA256 of the four SQL suites under
`supabase/tests/rls/history/demo-prefreeze/`, `concurrency.py`, its fixture/graph
files and the original tenant-guard migration to the exact bytes of `a58228a`.
The live checkpoint must contain all four reviewed pre-freeze body hashes and
their original owner, SECURITY DEFINER, language, configuration and ACL. A
disabled, changed or ambiguous body is rejected before tests begin.

Two fresh clones of that one checkpoint each run all four original rollback-only
suites and the unchanged two-session concurrency runner. This preserves positive
core compatibility, tenant graph behavior, isolation rejection, exact relation
locks and SQLSTATE `55P03`. The original test-only core stub remains confined to
historical clone transactions and is rolled back. No protected wrapper is
replaced, and no old function is installed on the final release database.

Random names are checked absent before CREATE; cleanup reconciles uncertain
creation only by name allocated by this invocation plus postgres owner and exact
numeric OID. It refuses changed owners/OIDs, force teardown, remote database
routing, remote Docker contexts, discovery and image pulls. Every Docker command
uses a fresh config and the local socket. Source/checkpoint app data and security
fingerprints must be preserved; both working clones and the checkpoint must be
removed. The required report is `reports/demo-guard-prefreeze/actions-result.json`.

`test-catalog.mjs --verify-prefreeze` gates continuing the migration replay;
`--verify-rls` requires the same report again. Verification checks the checkout
commit, fixed hashes, four suites and original concurrency each executed twice,
one checkpoint, two distinct removed clones and source preservation. Moving the
SQL outside discovery does not remove its mandatory execution contract.

## Final release checks

After the forward and before `_ci_post_migrate.sql`, `run-actions.py` verifies the
disabled wrapper and runs the real four-route 45-call rejection matrix in each of
two new strict clones of the final database. No core/helper stub is used. Each
call requires the entrypoint SQLSTATE 55000, complete row/sequence snapshots,
manual quote/shipment/pricing preservation and zero DML attempts observed with a
nontransactional counter.

The same clone then runs `persisted-disabled.py`: synthetic fixtures commit in
one connection; each of absent/old/recent cooldown states commits separately;
15 real rejected calls commit their outer transaction; a new READ ONLY connection
checks complete rows/sequences, metadata and marker against the committed
snapshot. The probe connection does not repair marker or business data. All three
connections must be distinct and verified local postgres sessions. The private
QA schema and fixtures remain only in the disposable clone, which is removed.

Normal RLS discovery runs the final base matrix plus exact copies for REPEATABLE
READ and SERIALIZABLE. The base matrix uses `run-compat-actions.py` under Actions
for exact service/socket verification; no fallback or cached credentials exist.
The isolation copies differ only by SET TRANSACTION immediately after BEGIN.

The old four suite paths are not part of final-state discovery. Their original
bytes live only in the historical subdirectory and must run before freeze.

## Limits

These checks require isolated CI execution before a runtime PASS can be claimed.
They prove the provisional disablement contract when executed, not safe enabled
regeneration, identity provenance or idempotent seed behavior. The release does
not revoke existing sessions. HTTP checks remain a separate boundary.
