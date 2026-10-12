# Two-session authenticated design, pending executable v2 suite

These are required executable cases, not claims of passing tests. Use the same
owned offline container and stdin `docker exec ... psql`; no external driver,
network port, installation or hosted DB. Commit only synthetic fixtures in a
separate owned disposable database cloned from the post-replay template. Record
its identity and remove it/container in finally. Never run the existing direct
UPDATE concurrency script as proof of canonical authenticated RPC behavior.

## Deterministic orchestration

1. Seed independent synthetic actors, exact CRM/lead/company graph and two
   valid Enviada quotations. Record expected pre-state and role checks.
2. Session A sets request claims plus `SET LOCAL ROLE authenticated`, calls the
   real RPC and retains its transaction after the RPC returns. It then waits on
   a test-only external barrier using a pipe/session input or pg_advisory_lock.
   Avoid granting authenticated access to an invented public synchronization
   table. `pg_advisory_lock` here is a test coordination lock, not an auth bypass.
3. An observer verifies A is idle-in-transaction after its RPC and owns the
   relevant row/transaction lock. Do not equate any granted lock with readiness.
4. Start session B with an independent authenticated connection and actual RPC.
   Observe `pg_blocking_pids(B)` containing A, B wait_event_type=Lock and both
   expected application_name identifiers. Fail if contention was never observed.
5. Release only the owned A barrier. Bound lock/statement/transaction duration;
   a 40P01 deadlock, 55P03 timeout, connection failure or raw 23505 is NOT an
   acceptable domain rejection. Capture errors separately from final assertions.
6. Verify both return codes and results, full final state plus unique counts,
   and retry each completed operation. Cleanup always runs and is evidenced.

## Required schedules

A. Two acceptances of different quotes in one opportunity:
   A wins, B waits and then fails only with the reviewed winner-conflict code.
   Exactly one accepted quote, one original seal, one opportunity winner/value,
   one closure audit and one real seller notice; loser is wholly unchanged.

B. Two acceptances of the same quote:
   second waits and returns the identical sealed version with sin_cambios=true;
   exactly one accepted-state transition/audit/notice.

C. Two conversions of the same accepted winning prospect:
   first creates or reuses client, second waits then returns same client and
   sin_cambios=true; one conversion audit, coherent lead/company/history.

D. Acceptance retry versus conversion of that accepted winner:
   both valid schedules must serialize without deadlock and preserve the
   acceptance seal; eventual client identity/state and unique counts agree.

E. Two valid accepted winners in different opportunities sharing a real RFC:
   test the real same-org unique-index race, not an injected success response.
   Both outcomes use one client; each opportunity/lead is coherent and separate,
   each actual conversion audit once. If lock ordering permits a deadlock,
   diagnose and review the production fix; do not absorb it as a pass.

F. Two different quotes of one opportunity attempting conversion:
   only the accepted winner may convert. The alternative quote must be rejected
   before mutation; confirm no cross-quote lock-order cycle and no re-linking to
   an unrelated opportunity. Do not manufacture two accepted winners by disabling
   the unique index or trigger to build this fixture.

G. Rollback winner race:
   A's canonical RPC obtains winner/seal then its transaction rolls back. B must
   finish as the sole valid winner, with no audit/notice/client remnants from A.

All schedules run on an owned clone. No whole production table cleanup, global
lock, generic database name discovery, broad pg_terminate_backend or wildcard
container removal is allowed. A failed assertion remains a failed run even if
cleanup succeeds. Killing an observer/holder is scoped to its verified owned
session PID and application name only.
