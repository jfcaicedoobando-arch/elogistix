# Acceptance candidate two-session concurrency module (draft)

Status: prepared and statically checked only. No PostgreSQL SQL, Docker command,
Git operation, migration, or remote database operation was executed while
preparing this deliverable. Passing these tests, once actually run, would be
bounded test evidence; it is not approval of the candidate.

## Inputs and boundary

- Candidate: `20261012160000_aceptacion_prospectos_crm.sql`; exact reviewed
  SHA-256 and Library version are bound in `review-contract.json`.
- Original conversion and closing/lead/company triggers are unchanged. The
  parent must replay the complete real schema and the exact candidate first.
- Table columns were checked against the exact baseline extracts from Git blob
  `3b527ef4369a9390fa2e256ec6042ffd0af20107`; function/trigger behavior was checked
  against the reference files and historical real-schema catalog evidence.
- The parent must call this module only in its verified owned Docker container,
  on a disposable database clone. Fixtures are deliberately committed because
  two independent transactions must see them. Remove the clone/container after
  collecting evidence; this module does not delete fixture rows individually.
- No business function, trigger, constraint, ACL, RLS policy, or role hierarchy
  is replaced, relaxed, or disabled. Helpers exist only in the sessions' temporary
  schemas and are SECURITY INVOKER.
- Privileged `postgres` seeds synthetic auth and business fixture rows. Every
  operation under test and every deliberate business-row lock uses actual
  `SET LOCAL ROLE authenticated`, a real seeded JWT subject, and the real tenant,
  membership, and authorization functions. No `service_role`/super-admin path or
  bypass GUC is used for business operations.
- Membership triggers create `user_roles`; the fixture asserts exactly one
  `gerente_operaciones` and one `vendedor`, with no direct role-table insert.
  The manager's legacy conversion authorization through `roles_jerarquia` is
  asserted, not implemented by a test substitute.

## Parent integration API

Import `ConcurrencyContext`, `EXPECTED_CASE_IDS`, and `run_concurrency` from
`concurrency.py`. Supply:

- `query(sql, label, timeout=seconds) -> (stdout, stderr)`: the parent's strict
  query helper, connected to the same disposable clone. It must raise on a
  nonzero exit, preserve stdout/stderr, and respect the timeout.
- `psql_argv`: the parent's explicit owned-container command, for example:
  `['docker', 'exec', '-i', '-w', '/tmp/repo', owned_container, *pg_env,
  'psql', '-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1']`.
  `pg_env` must contain the existing clean `/usr/bin/env -i ... PGDATABASE=...`
  invocation. No shell command, network route, host port, connection URI, remote
  host, or unrelated container is introduced here. A copy of argv is recommended.
- `env`: the parent's clean Docker environment, including
  `DOCKER_HOST=unix:///var/run/docker.sock` and its isolated `DOCKER_CONFIG`.
- `evidence_dir`: the parent's fresh reports directory. The module creates a
  previously nonexistent `concurrency/` child directory.

Example integration (illustrative, not executed here):

```python
context = ConcurrencyContext(
    query=query_clone,
    psql_argv=['docker', 'exec', '-i', '-w', '/tmp/repo', owned, *clone_pg_env,
               'psql', '-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
    env=docker_env,
    evidence_dir=out,
)
concurrency_cases = run_concurrency(context)
require([c['id'] for c in concurrency_cases] == list(EXPECTED_CASE_IDS),
        'Incomplete concurrency evidence')
```

The parent owns environment/container validation, exact source pinning, replay,
candidate loading, catalog parity checks, and unconditional container cleanup.
The module verifies its command shape but cannot independently establish that
`query` and `psql_argv` point to the same owned clone. It has no fallback to a
network connection or another database.

## Complete required cases

1. `same_quote_accept_accept`: A accepts a sent prospect and holds the transaction
   open. B calls real acceptance on the same quote. `pg_blocking_pids(B)` must
   show A. A commits; B returns `sin_cambios=true`. Full tracked-row state is
   identical before/after B's commit.
2. `competing_accept_busy_then_conflict`: A accepts one quote, retaining the
   opportunity lock. B accepts its sister and must return exact SQLSTATE `55P03`
   with `LC_COTIZACION_EN_PROCESO:`. This expected recoverable error passes that
   phase. After A commits, B retries and must receive `P0001` with
   `LC_COTIZACION_GANADORA_EXISTE:`; no losing seal/writes survive.
3. `competing_accept_retry_after_rollback`: same initial NOWAIT contention, but A
   rolls back. The entire baseline row snapshot must be restored. B retries the
   sister and succeeds as the sole winner. The original quote then receives the
   winner-conflict response.
4. `same_quote_convert_convert`: after real committed acceptance, A runs the
   ORIGINAL conversion and holds the transaction. B runs that conversion on the
   same winner and must block on A. After A commits, B returns the same client,
   `sin_cambios=true`, `creado=false`, zero relinks, and changes no tracked rows.
5. `sister_accept_during_conversion_commit`: B explicitly holds the sister quote
   row under authenticated RLS. A runs the ORIGINAL conversion and must be
   observed blocked by B, while A holds the exact opportunity row. B now calls
   real acceptance and must return `55P03/LC_COTIZACION_EN_PROCESO:` without a
   deadlock. A must remain blocked until B explicitly rolls back its outer
   transaction. A then completes and commits. A sister retry receives the
   winner conflict and changes no rows.
6. `sister_accept_during_conversion_rollback_retry`: the same real conversion vs
   sister lock interleaving, but A rolls back after its RPC completes. The full
   preconversion accepted snapshot is restored. B then retries ORIGINAL
   conversion, creates one committed client, and the discarded generated client
   is not reused. A sister-acceptance retry still correctly conflicts.
7. `accept_retry_waits_for_conversion`: A converts an accepted winner and holds
   the transaction. B retries acceptance on that same winner and must block on
   A's quote. After A commits, B returns unchanged through the existing-client
   path with `origen_aceptacion=autorizacion_cliente`, retaining the original seal.
8. `shared_lead_company_conversion_blocks_acceptance`: two distinct open
   opportunities share one real qualified lead and company. A's quote is
   accepted canonically first. A then performs ORIGINAL conversion; B's acceptance
   of the other opportunity must block on the shared lead despite holding its
   own different opportunity. A's company promotion lock is independently
   observed. After A commits, B receives
   `P0001/LC_COTIZACION_ACEPTACION_INCONSISTENTE:` and rolls back fully. The other
   opportunity stays open and has no winner/client; its quote is not relinked.

## Deterministic barriers and evidence

There are exactly two persistent business sessions per case. Read-only catalog
observation uses the parent's additional query connections. At most one third,
transient row-lock observer runs at a time. It uses the same authenticated
manager, JWT subject and tenant as the holder, executes no business RPC and
changes no row values. It is explicitly cancelled and rolled back before
continuing. This is a real PostgreSQL interleaving test, not a thread-only or
SQL-string simulation.

- Blocking success requires the exact expected holder PID in
  `pg_blocking_pids(waiter)` and `wait_event_type='Lock'`. It is never inferred
  from elapsed time or an unfinished Python process.
- Held-row proof uses a transient authenticated `SELECT ... FOR UPDATE` on the
  exact allowlisted table and fixture UUID. The observer must be active in
  `acceptance_concurrency` with its unique application_name, waiting on
  `Lock/transactionid`; its sole blocking PID must be the expected holder.
  Its waiting ShareLock must match a granted transactionid ExclusiveLock of
  that holder, whose own top-level transaction lock must also remain present.
  Observer and holder PID/database/application_name and exact observer SQL are
  recorded. This does not equate tuple xmax with a live XID lock: PostgreSQL
  releases a completed subtransaction's XID lock while retaining its parent
  transaction and row locks.
- After observing contention, only that exact observer PID, database,
  application_name and still-active query may be cancelled. It must report
  SQLSTATE 57014 with the explicit user-cancellation message, then complete
  ROLLBACK. A timeout, acquired/missing row, wrong blocker, unrelated SQL,
  failed cancellation or changed identity fails closed. Cleanup of that owned
  session also runs unconditionally on every exception. Failure-path cancellation
  of any session filters its exact PID, database and unique application_name;
  no bare-PID cancellation fallback is permitted.
- Probe a row before starting the second business RPC on it, so the observer
  cannot queue behind that RPC's own tuple lock. The later business-blocking
  assertion separately observes its exact holder PID and verifies the earlier
  row proof still belongs to the same holder backend_xid, database,
  application_name and live top-level XID lock. A transaction boundary or
  recycled backend invalidates the proof.
- NOWAIT races use that held-row barrier before invoking the contender and assert
  the exact domain error. They do not classify every `55P03` as acceptable.
- Psql completion requires a per-command unique marker, with bounded deadlines.
  `40P01`, unexpected timeout/error, missing marker/barrier, missing case, or
  wrong JSON response fails the suite.
- Limits: 20-second PostgreSQL statement timeout; 18-second lock timeout;
  45-second idle-in-transaction timeout; 25-second command acknowledgment;
  12-second barrier observation; 240-second total suite deadline. Cleanup has
  its own bounded wait/cancel and only targets owned session PIDs. Row observers
  share these same bounds, and their SQL, identities, raw pg_locks, cancellation
  result and completed rollback are preserved in the ordinary evidence.
- Poll backoff sleeps merely avoid a busy loop. Every success requires observed
  lock evidence and the expected completed RPC responses.

Every final accepted fixture verifies exactly one sealed accepted quote, one
winner, one stage-history transition, one acceptance audit, one CRM closure
activity, and one seller CRM won notification. Conversion verifies exactly one
client and one conversion audit, coherent quote/opportunity/lead lineage, all
same-opportunity historical relinks, unchanged other opportunities, and the
original company's `estado_crm=Cliente` promotion. It deliberately asserts that
`crm_empresas.cliente_id` remains null because the ORIGINAL conversion/trigger
does not populate that field. It does not invent a stronger original contract.

Before/after JSON snapshots include organizations, organization_members,
user_roles, the seeded auth.users, clients, quotes, quote version snapshots,
opportunities, pipeline stages, stage history, leads, companies, opportunity
company links, activity audit, CRM notifications, shipments, and invoices.
Retries/rejections are compared for exact equality across those tracked rows.
These are not an assertion that every other table in the entire schema is
unchanged; the parent may additionally snapshot the entire disposable database.
Sequence advancement is intentionally not asserted transactional.

`concurrency/result.json` records running/fail/pass, the complete case inventory,
limits, completed cases, and barrier evidence. Per-session SQL/stdout/stderr and
per-observer SQL plus parent logs provide failure diagnosis. The module returns
only after all eight cases pass; exceptions must propagate to a failing CI.

## Static regression checks

Run `python3 scripts/ci/acceptance-candidate-review/test_lock_probe.py`.
These offline unit checks reject mismatched PID/database/application_name,
missing or wrong XID locks, wrong SQL, missing holder XID, an uncontended row,
failed cancellation and reuse across transactions. They verify unconditional
observer cleanup, no business RPC in the probe and the unchanged eight-case
inventory. They do not count as PostgreSQL runtime cases.

## Accurate remaining limitations

This deliverable was only syntax-compiled and statically inspected. Real-schema
execution, PostgreSQL 17.6/17.9 compatibility, runtime fixture validity, and all eight
actual interleavings remain unverified until the parent runs it. It does not
prove all possible schedules, every isolation level, network/retry behavior in
the frontend, cross-tenant authorization outside these asserted positive actor
contexts, or global absence of deadlocks. The candidate's NOWAIT applies to the
opportunity acquisition only: quote, lead, company, and stage locks can still
wait. Additional shared-lead/company schedules may produce ordinary business
conflicts; these eight expected outcomes do not authorize weakening guards.
Concurrent creation with the same non-generic RFC from two different prospects
is not exercised by these eight schedules; single-session RFC reuse and tenant
scoping are covered by the semantic suite.
