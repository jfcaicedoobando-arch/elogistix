# Financial engine review lane â€” HOLD

The complete financial engine is **NOT_RUN**. This draft prepares an isolated
Actions lane, authentic integration scripts and a canonical dependency inventory.
It does not certify the unavailable Library proposal, production compatibility,
RLS, real identity, HTTP, persistent wire transport, COMMIT/ACK or activation.
The demo remains disabled. No application source, deployed role or migration changes.

## Evidence and gates

- Source baseline: main `5d1f00d27628100a58ab166367a067ea90068b84`.
- Canonical baseline source: blob `0d45d45881096808d8dcf1ca3831559d8759f477`,
  SHA256 `a8be935dd3839a7cc0bb94873ef5dd84c452d1f7405d7b050a995dadc514d0d2`.
- `dependency_report.json` is a conservative source inventory, always complete:false.
  Dynamic SQL, external fixtures and support-table INSERT paths still require review.
  It is not the 276-definition proposal and never executes historical seeds.
- `catalog-status.json` blocks Docker before any SQL until the canonical closure
  and two-tenant fixtures are complete. `sql/catalog.sql` and
  `sql/canonical-fixture.sql` deliberately raise an explicit blocker.
- Library resolved version 0, but its supported transfer failed; ZIP bytes, ZIP
  SHA256 and TRANSFER-SHA256SUMS remain NOT_RUN. See `evidence/transfer-status.json`.
- Existing PR344 producer/origin/registry and PR345 synthetic human-helper results
  remain separate. Their PASS does not certify this financial engine.

## Authentic integration prepared

`sql/setup.sql` preserves the private installer's existing rolsuper-or-bypassrls
guard. Bootstrap creates only an explicitly labelled
`demo_financial_fixture_owner LOGIN NOSUPERUSER BYPASSRLS NOINHERIT` in the
disposable container. It is a synthetic authority model, not proof of RLS or real
identity. The historic seed-core fixture raises if called; it supplies owner
metadata only. No approval, origin, registry or authorization function is replaced
with a success stub.

The install order is private writer, manifest, engine, identity, issuer10â€“16,
authentic bridge and producer, then simulation guards. New fixture input must
provide exact explicit UUID mapping, canonical rows, protected synthetic scheduler
policy and two-tenant manual sentinels. Authentic producer and registry create the
identity receipt and server admission; the genuine private RPC boundary issues
the run and invokes execute_and_checkpoint. No harness INSERT creates their
authorization receipts, financial rows or checkpoints.

Happy path checks 13 paired events/receipts, 3 current approvals, 1 simulated
payment, issuance mapping, projection/checkpoint/marker/receipt coherence and
unchanged replay. Five independent fresh databases inject exact failures at event,
receipt, checkpoint, marker and execution receipt, and compare every row in public,
auth, writer and identity schemas after rollback. Unexpected errors fail.
A test-only definer flushes authentic deferred constraints while the selected technical role remains service_role; it checks the authentic transport predicate and does not swallow failures. These SQL files are prepared, unparsed and unexecuted until the catalog gate closes.

`source-map.json` pins 15 copied published SQL inputs by Git blob and SHA256.
Only the package's manifest copy adapts its payment method/reference/notes to the
existing engine literals: Transferencia / DEMO-PAGO-001 / Pago parcial demo.
Transferencia is the canonical column's text default. Original published packages
are untouched. Every copied approval, issuer, origin and registry function is exact.
Further fixture drift and canonical constraints are listed in CATALOG_REVIEW.md.

## Isolation and result handling

The runner pins postgres by digest, verifies server_version_num=170006, and uses
an internal Unix socket. Container networking is none, listen_addresses is empty,
ports are unpublished, no host mounts or persistent data volumes exist, and PGDATA
is bounded tmpfs. No secrets, .env, real DSN or inherited PG/Docker settings are read.
Only the pinned image is acquired by Actions before isolated execution; create
uses --pull=never. Docker access fixes the local Unix socket.

Every executable byte is hashed and copied into a sealed input snapshot. The
runner verifies image identity, ownership, command, environment, networking,
mounts and privileges. It destroys the exact owned container and proves absence
before engine PASS. Daemon/inspect/cleanup errors fail; they never count as absence.
Incomplete catalog creates a BLOCKED/NOT_RUN artifact without contacting Docker.

## Reproduce offline

```sh
python3 -B -I -m unittest discover -s scripts/ci/demo-financial-engine-review -p 'test_*.py'
python3 -B -I scripts/ci/demo-financial-engine-review/offline_checks.py
python3 -B -I scripts/ci/demo-financial-engine-review/run_ci.py
python3 -B -I scripts/ci/demo-financial-engine-review/extract_catalog.py --baseline supabase/schema/baseline.sql --out /tmp/new-canonical-review --diagnostic
```

Offline PASS means integrity/parser/runner tests only. On this executor Docker,
psql and WSL are unavailable. The draft Actions lane intentionally reports BLOCKED
until the missing canonical catalog and fixtures have been reviewed and exercised.
No merge, deploy, database migration or activation is included.
