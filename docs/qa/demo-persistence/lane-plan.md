# Isolated PostgreSQL17.6 store and claim lane

Runtime status: **NOT_RUN until the exact Actions artifact is inspected**.
The lane is implemented in `scripts/ci/demo-persistence-review`. Its input is
the original authored Git export at `860ac59cc9b6d80887c1a7811e2c81ef8ef17ca8`.
The historical Library failure is separate and does not block this Git contract.
No ZIP or TRANSFER-SHA256SUMS verification is claimed.

## Input and byte preservation

Twelve files are copied unchanged from the pinned export. `sources.py` requires
the exact file set, regular files, the manifest and all eleven payload checksums.
Manifest SHA256: `d0a7c1655f9d137f7c88d5489318f42639f7c2548ec627fec7134363afbc2335`.
Store SHA256: `fb7fa69c17eca7230606ecb6217086c6eb5317d75551df9efc268959f69140a7`.
A scoped Git attribute disables text conversion on these authored inputs.

The verified store bytes enter binary subprocess stdin and a write_bytes SQL
log; all hashes must agree. No setup or transaction text is prepended.
Original store.mjs dispatch/ingress queries are retained verbatim within PREPARE.
Parameters and issuer/business rows are exclusively synthetic.

## Isolation and admission

The new gate requires Actions, a same-repository draft PR, the persistence branch,
reviewed main base and exact event head. Only a fresh evidence directory is
accepted. There is no connection, arbitrary image or live-mode parameter.

The imported CRM infrastructure remains unchanged, pinned to SHA256
`a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816`.
Its main, gate, preparation and cases are not used. The adapter inherits owned
container lifecycle, queries/sessions, observed locks and cleanup.

Image: `postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`.
Runtime requires version 170006, socket only, no TCP, candidate NOSUPERUSER, no
admin membership or catalog DML. Network none, no ports/host mounts, read-only
root, dropped capabilities, no-new-privileges and resource limits are checked
before cleanup. Roles and databases exist only in the disposable container.

## Runtime matrix

The runner requires 54 unique store/claim cases plus exact compilation and
the closed-business-boundary check. Negative cases require precise primary
SQLSTATE and equal issuer/claim/business rows before and after rejection.

| Area | Required observations |
| --- | --- |
| Exact compilation | Original store bytes compile as candidate; file/stdin/log hashes agree. |
| Issuance/bindings | Natural tuple rejects different IDs/bindings; checks, PK, context uniqueness and each binding component's FK mismatch reject. |
| Append-only | UPDATE/DELETE/TRUNCATE reject for both tables with zero/populated rows. Issuer TRUNCATE names both FK tables so its trigger is reached. |
| Original queries | No ingress without dispatch; wrong deployment/context returns zero; first claim returns one, duplicates zero; no SELECT-based authority. |
| Separate claim | Different observer PID; invisible before COMMIT, visible after COMMIT before synthetic business. |
| Two connections | Actual ungranted lock and blocking PID; committed winner makes loser return zero; rollback before claim commit permits the fixture contender to win, without authorizing app retry. |
| Later rollback | Explicit rollback and constraint failure remove synthetic effects while committed claim remains; duplicate returns zero and starts no business. |
| Closed boundary/cleanup | Original business entrypoint absent; clients reaped; cluster stopped, PID absent, owned container removed and removal confirmed. |

Only qa_synthetic.business_events models business effects, without an obligation
unique key that could hide duplicate invocations. These cases do not execute
the JS owner against a physical driver or certify a real issuer, identity,
authentication, engine or financial checkpoint. The original 25 Node tests are
separately registered/executed through the catalog with their original filename.

## Remaining gates

Inherited startup uses fsync off and tmpfs. This establishes transaction commit
visibility and preservation across a later rollback, not crash/WAL/hardware,
failover or restore durability. Schema-owner triggers are not an ACL or
administrative-restore security boundary.

Physical exclusive connection, decoded ReadyForQuery/CommandComplete, socket
epoch, no reconnect/replay, real issuer/ACL/guard/business integration, durability
and read-only reconciliation remain independent **NOT_RUN** gates.
Postgres.js reserve alone is insufficient. Wire **UNBOUND**, configuration empty,
endpoint closed. Intended semantics remain at-most-once with quarantine, without
exactly-once or guaranteed availability.
