# Separate channel: estado comprometido observado

This draft is stacked on PR #351 at `a4778ec3933e2c6d04839d448fb894d76b19a6a7`.
It does not modify `transaction_envelope.py`, `comparator.py`, any inherited
capture SELECT, schema, canonical migration/mirror, journal, workflow or fence.
The 70 materialized inherited source files are byte-pinned in
`committed-inputs.json`; their Git blob identities were verified against that
exact parent before implementation. No private target capture belongs in Git,
a PR, a CI artifact or an issue. Only invented disposable fixtures are public.

## Two different evidence APIs

`comparator.compare` retains its original actual-RETURNING requirement.
`committed_state.compare_committed_state` never calls that API, supplies no
fabricated receipt, and accepts no RETURNING, execution outcome or retry flag.
Its result is named **estado comprometido observado** and always says
`NOT_ADMITTED`, `NOT_GRANTED` for retry, and `NOT_ESTABLISHED` for rollback and
execution attribution. The observation does not identify which invocation
produced a committed row. The SQL DO still uses its own original internal
INSERT RETURNING and validation; losing an external NOTICE does not remove any
in-statement check, lock, recapture, payload or terminal-state check.

The new comparator requires:

1. Complete before and after bundles, all projections passing the unchanged
   Draft 2020-12 schema and exact history/identity checks. It never narrows the
   captured catalog, bindings, activity, Supabase manifests/pages or history.
2. `capture.xid_if_assigned` is exactly JSON null in **every** relevant envelope
   on **both** sides, and in both separate builtin/handler binding witnesses.
   In particular, this value and the complete Drizzle history must be outputs
   of the **same inherited SELECT**. A separate idle check, an activity PID,
   read-only label, null claim or later query cannot substitute for it.
3. The inherited conservative ledger reader profile, including permanent
   ordinary tables. A permanent INSERT assigns a transaction ID. Thus a
   still-open outer transaction cannot claim its own uncommitted insertion as
   committed simply because its own backend can read it. Even unrelated
   assigned XIDs conservatively reject. There is no requirement for a different
   PID: the original backend, after COMMIT, can provide a NULL-XID observation.
4. Exact unchanged discovery, exact canonical helper ACL and shared-dependency
   postimage, all other scoped metadata unchanged, and exact before/after
   builtin and handler binding results. Both binding witnesses are independently
   checked against the inherited public semantic profile.
5. Exactly one new canonical hash/timestamp Drizzle row, every prior row
   unchanged with complete row and aggregate commitments, no pre-existing
   hash/timestamp conflict or future migration. It observes the row; it does
   not rename it an original RETURNING value.
6. The inherited supported sequence profile and exactly one measured next
   allocation, aligned to that observed row, with unchanged sequence identity.
   Extra allocations/gaps, unsupported sequence behavior, row additions or
   deletions, ACL/dependency drift, conflicting registration, changed Supabase
   commitments and missing evidence reject.

The complete before/after bundles remain multiple observations, not one atomic
snapshot. Authentic source/endpoint provenance, catalog completeness, reviewed
default semantics, independent owner or sequence-writer exclusion, external
consumers and a new authorized DDL/ACL window remain outside this comparator.
The default tree and supplied baseline must be independently reviewed. Exact
baseline preservation does not require replaying or reauditing all historical
SQL. NULL XID is not an authentication mechanism or a promise that a later
capture remains current.

## Absence is never rollback or retry permission

If the history has no new row, the comparator rejects. It cannot tell whether
an attempt never started, is waiting/running, rolled back, or completed after
this reader's snapshot. A missing NOTICE proves none of those alternatives.
A row plus NOTICE seen by an open writer can still roll back. Sequence advance
without a matching committed row is not proof that retry is safe. All missing,
rejected and unavailable CLI results explicitly withhold rollback and retry
conclusions. Reconciliation does not solve adapter ownership/cleanup/deadline
requirements and does not authorize another write.

## Local offline use with complete private files

The existing file-map format is unchanged: kind plus one local filename per
bundle projection, and an explicit list of all Supabase page filenames.
The auxiliary binding files are direct `crm-transaction-bindings-v1` envelopes
or exact `{"rows":[{"crm_bindings": ENVELOPE}]}` wrappers. Preserve each capture's
own timestamps, snapshot, PID and XID; never manufacture missing fields.

```sh
python3 -B scripts/ci/crm-operational-events-review/committed_offline_review.py \
  --before-manifest /private/before-files.json \
  --after-manifest /private/after-files.json \
  --before-bindings /private/before-bindings.json \
  --after-bindings /private/after-bindings.json
```

This reads only explicitly supplied local files, uses installed offline Python
Draft202012Validator or PowerShell Test-Json, and prints sanitized statuses.
It cannot query a database, execute SQL, apply, retry, register or emit a
receipt. Exit 0 means matched supplied committed-state observations, never
admission. Exit 2 means rejected/incomplete/unavailable, never rollback.

## Isolated verification and limits

The dedicated `crm-committed-state-review.yml` admits only this draft branch,
the same repository and the exact recorded parent. A moved parent rejects
before Docker. It uses the inherited digest-pinned PostgreSQL 17.6 container,
network disabled, no host database ports, sanitized environment, unprivileged
container, ownership token, bounded resources and confirmed cleanup. There is
no DSN, target URL, workflow_dispatch, secret or operational mode. Local socket
access is neither attempted nor required; PostgreSQL execution is Actions-only.

Offline tests cover the separate API, unchanged receipt comparator, no input
mutation, NULL XID on every projection, same-PID acceptance, complete history,
sequence gap/profile, bindings, ACL/dependency/catalog/Supabase drift,
conflicts, incomplete input, input validation and sanitized CLI failures.
Reduced semantic doubles explicitly mock only inherited reader/binding
boundaries; they do not claim Draft validity. Real complete PG captures use the
actual inherited checks and actual offline Draft validation in the Actions lane.

The fifteen isolated cases include NOTICE suppression at commit; modeled
adapter loss of all output after commit; an exact replay whose original
contract said registration was absent, rejecting before any second effect;
an open outer transaction seeing its own permanent row while rejected for
assigned XID; an independent reader not seeing that row; the same writer
backend accepted after COMMIT; NOTICE followed by rollback; real sequence gap,
extra history row, catalog, builtin binding, Supabase and registration conflict
mutations; assigned-XID/incomplete evidence negatives; and the unchanged public
fence. The response-loss case deliberately discards a completed fixture
process response. It tests independence from that response, **not** an actual
remote adapter's timeout/disconnect/cleanup guarantees.

At publication: offline tests run locally; PostgreSQL results are pending the
exact draft-head Actions run. No real SQL, deployment, access expansion, merge
or production operation is part of this draft. Passing synthetic tests would
still leave every observation `NOT_ADMITTED`.
