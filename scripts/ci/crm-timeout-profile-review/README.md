# Isolated CRM 120s / local 3s profile experiment

**NOT_ADMITTED.** This is a separately fenced laboratory proposal, not an
operational adapter. It is stacked on PR #356 at
`8589793b1c013ef1adc5bb1e4496e87ae3ad037b`; #351's program, #356's comparator,
all inherited pins, canonical/mirror/journal, capture SQL/schema and workflows
remain unchanged. The new inherited manifest pins 81 files verified against
that exact Git tree. No real database, Lovable change, deployment, access grant,
secret, migration execution or production enablement is part of this PR.

## Explicit profile

| Stage | Visible statement_timeout | Visible lock_timeout |
| --- | --- | --- |
| Entry, before outer DO | 2min | 0 |
| Local setup and preimage under locks | 2min | 3s |
| After unchanged canonical nested DO | 20s | 3s |
| Postflight, after transaction completion | 2min | 0 |

The effective outer statement deadline is **120 seconds**, armed before DO.
The canonical payload sets the displayed statement GUC to 20s but cannot re-arm
the enclosing running statement's timer. A fixed TEST_ONLY 125s sleep immediately
after the canonical payload must still be active after 25s and fail natively
with SQLSTATE 57014 near 120s. The client watchdog is longer than that deadline;
client termination is not accepted as a PostgreSQL timeout witness.

`lock_timeout=3s` and `search_path=pg_catalog` are local and set before catalog
queries and explicit locks. They protect later individual lock waits, including
an observed pg_proc tuple/transaction wait at REVOKE; they do not bound prior
parse/initialization work, aggregate waits or an open outer transaction.
The original three ordered NOWAIT locks remain. A same-session test measures
restoration only after commit, and an explicit open writer still has 20s/3s.
No capture is normalized to conceal an open transaction.

PostgreSQL 17.6 source:
- [Running statement deadline setup](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/tcop/postgres.c#L4900-L4923)
- [Per-wait lock timeout](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/storage/lmgr/proc.c#L1156-L1188)

## Immutable validity window

`CandidateWindow` is frozen and requires exact UTC timestamps with microseconds,
a strictly positive duration of at most ten minutes, and no caller-controlled
SQL. The renderer embeds those timestamps in the candidate. Retries must reuse
those exact bytes; a retry does not refresh them. PostgreSQL `clock_timestamp()`
checks the half-open interval before locks, immediately before the canonical
payload and before registration. Expired or not-yet-valid requests fail even
when a ledger lock is held by another fixture session. A separate fixed 4s wait
proves expiration during the program rejects before the payload or allocation.

This window is candidate validity, **not user authorization**. It does not prove
that an outer COMMIT occurs before expiry. External finalization/cleanup and
exclusion of relevant writers must remain established through postflight.
Ten minutes is a conservative bound of this experimental input shape, not a
real authorized DDL/ACL window.

## Preserved gates and evidence

The public renderer's first executable action is an unconditional
`CRM_TIMEOUT_NOT_ADMITTED` exception, before constants, local settings, locks or
effects. It has no enable flag, transport, CLI, database connection or fault
argument. A separate TEST_ONLY renderer accepts only this lane's owned
`crm_acl_fixture_timeout_*` fixtures. Names alone never admit real targets.
Normal public and TEST_ONLY inner programs must be byte-identical and have an
independently recalculated SHA256. The three test fault variants each differ
only by one exact fixed injection. The canonical payload is decoded and
executed without changing a byte.

The inherited complete preimage, metadata-before-data, builtin/handler binding,
exact default registration and terminal checks remain. Concurrent duplication
fails NOWAIT; a stale sequential request rejects its changed preimage. Fresh
terminal registration returns without payload or allocation. A rollback after
INSERT leaves its measured sequence gap; reusing that candidate fails rather
than resetting the sequence or inventing a new preimage.

PR #356's comparator receives genuine complete before/after captures, never a
fabricated RETURNING. Lost output after commit can yield **estado comprometido
observado**. An open writer's own assigned-XID row and the independent reader's
missing row do not establish commitment or grant retry permission. The same
backend can observe after COMMIT with NULL XID. Every summary remains
NOT_ADMITTED, without execution attribution or rollback/retry claims.

The owned synthetic matrix includes profiles, unchanged public fence, exact
commit, restored session, registered and stale/concurrent replay, bad entry
GUCs, immutable early/during-program expiration, observed implicit lock timeout,
actual 120s cancellation, rollback gap and blocked retry, lost response after
commit and while open, and same-backend committed-state comparison. Inherited
negative comparator tests still cover extra registrations, catalog/bindings,
Supabase, XID and incomplete evidence. This lane does not authenticate real
transport, prove full ERP replay, or extend the original F2/external-writer claim.

## Isolated validation

`run_timeout_ci.py` admits only an exact same-repository draft PR, exact branch
and base, and the event's exact checked-out head. The workflow reuses the
inherited digest-pinned PostgreSQL 17.6 image with no network, mounts, exposed
ports or secrets. It verifies every inherited input before starting Docker and
preserves teardown evidence. Only synthetic projections and generated fixture
programs may enter artifacts. Private captures or proposals must never enter
Git, PRs, Actions or logs.

Offline commands:

```
python3 -B -m unittest discover -s scripts/ci/crm-operational-events-review -p 'test_*.py' -v
python3 -B -m unittest discover -s scripts/ci/crm-timeout-profile-review -p 'test_*.py' -v
```

Local results: 139 inherited tests (138 pass, one PowerShell availability skip)
and 16 new offline tests pass. This worker's socket restriction prevents local
PostgreSQL execution; the runtime evidence is the separately recorded Actions
run, not a claim of local execution.

## Remaining operational admission

Real adapter acceptance remains pending: intact one-statement delivery, no
extra ledger writes or split payload, deadline prearming, request-owned
transaction completion/cleanup, immutable bounded retries, authentic complete
postflight evidence, and the relevant writer/external-consumer exclusion window.
No exactly-once invocation, mandatory NOTICE delivery or particular PID reuse
is inferred. Do not remove a public fence or use TEST_ONLY as a real route.
