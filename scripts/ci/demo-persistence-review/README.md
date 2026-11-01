# Isolated demo persistence review

The input is the 12 original Git files from
`860ac59cc9b6d80887c1a7811e2c81ef8ef17ca8`, under
`docs/review/demo-durable-owner-adapter-20261015`. `sources.py` pins the exact
SHA256SUMS.txt and verifies every payload. Scoped Git attributes preserve authored
bytes. Store SHA256 is `fb7fa69c17eca7230606ecb6217086c6eb5317d75551df9efc268959f69140a7`.
The original package's README, plan and validation files retain their authored
source-time status; subsequent runtime results are recorded separately below.

The historical directory contains exactly those 12 files. The later
`authority-provider.mjs` and `issuer-entry.mjs` proposal lives separately in
`docs/review/demo-authority-provider-entry-20261016/`; its consumers reference the
original driver/issuer/store without changing their bytes. The historical
manifest, file census and rejection controls remain fixed.

This input is independent of the historical Library ZIP transfer failure.
No ZIP materialization/hash or TRANSFER-SHA256SUMS verification is claimed.
`intake.py` retains its separate fixed ZIP contract. Missing ZIP bytes do not
block the verified Git-source lane.

## Offline validation

```text
python3 -B -m unittest discover -s scripts/ci/demo-persistence-review -p 'test_*.py' -v
node scripts/ci/test-catalog.mjs --output <inventory-output>
node scripts/ci/test-catalog.mjs --run node-demo-durable-owner <inventory-output>
```

The catalog explicitly registers and executes the original `owner.test.mjs`
(25 synthetic tests) and five catalog regressions. Python tests cover integrity,
rejection, metadata hygiene, event gates, binary stdin and harness parsing;
they never start SQL or Docker. Public-file guards reject private source
identifiers and local profile paths in tracked review files.

The main CI detector runs this Python suite unconditionally after selecting
Node 26.13.0. Missing files, extra files, links and altered payload/manifest bytes
must fail at their specific integrity checks. This offline step does not invoke
the gated SQL runner or change its reviewed branch/base requirements.

## PostgreSQL lane

Only the draft-PR Actions workflow may run `run_ci.py --output <fresh-directory>`.
Its independent gate fixes repository, branch, base and exact head. It accepts
no DSN, host, credentials, arbitrary image, existing container or live mode.
It imports hash-pinned CRM infrastructure without changing its sources/workflow;
CRM's main, gate, preparation and cases are not invoked.

PostgreSQL17.6 is fixed by digest, with network none, TCP disabled, no host
mounts/ports, read-only root, dropped privileges and limited resources. Only an
owned socket and tmpfs fixture are used. Candidate postgres is NOSUPERUSER with
no administrator membership or catalog writes. Roles/databases are container-local.

The exact store byte buffer enters psql binary stdin and is logged unchanged,
without setup concatenation or rewriting. Original store.mjs dispatch/ingress
queries are exported through Node and retained verbatim inside PREPARE with
synthetic parameters. The matrix covers natural-key uniqueness across different
IDs/bindings, binding FKs, append-only rejection on empty/populated tables, live
claim returns, separate committed visibility, observed two-connection races,
and later synthetic business rollback. Business effects use an explicitly
SYNTHETIC table without obligation uniqueness that could conceal duplication.
The original unbound business entrypoint remains absent.

PASS requires the exact named matrix and confirmed client/cluster/container
cleanup. Evidence includes source/workflow hashes, input/stdin/log hashes,
role/version context, row snapshots, precise SQLSTATEs, PID/lock traces and cleanup.

The inspected [Actions run 38806953890](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38806953890)
on `eaeeeabba1624f63081a455e529af43f1633082a` passed 56 unique checks.
Artifact 12006303781 ZIP SHA256 is
`4c08a0503a7005e84c6a1f38fe6182a58b9291059989ca8be72c3bed5ffbd327`.
Byte hashes, 40 negative-state snapshot pairs, actual two-session blocking and
owned cleanup were inspected. This is **PASS_SYNTHETIC_ONLY**.

## Boundaries

Inherited startup uses fsync off and ephemeral tmpfs. Separate COMMIT visibility
and preservation across business rollback are tested; crash/WAL/hardware,
failover and restoration durability remain unproven. Schema-owner tests do not
certify real ACL isolation, issuer authentication or identity. The business
fixture does not certify an authentic engine or financial checkpoint.
SQL tests do not bind a physical wire or certify ReadyForQuery/socket epoch.

Wire remains **UNBOUND**, configuration empty and endpoint closed. The proposal
is at-most-once with quarantine, without exactly-once or availability guarantees.
See [status](../../../docs/qa/demo-persistence/status.json),
[lane requirements](../../../docs/qa/demo-persistence/lane-plan.md) and
[driver gates](../../../docs/qa/demo-persistence/driver-evidence.md).
