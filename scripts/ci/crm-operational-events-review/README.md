# Public event-handler experiments and prospective envelope

This is a separate review lane stacked on PR 346 at recorded base `3ca13983dc08c075155da9910e4f042aae90c2fe`. It changes no canonical migration, mirror, existing lab renderer or proposal fence. A newer main or parent tip is not a replacement for that recorded base; any retargeting requires a fresh source review and new event pin.

No actual target capture, object identity, history result, contact or credential belongs in these files, workflow inputs or artifacts. The runner accepts only an output directory. It creates its own network-disabled, socket-only disposable PostgreSQL 17.6 cluster using the inherited pinned image and ownership checks. It accepts no DSN, existing container or operational execution option.

## Public source

`upstream/provenance.json` records an immutable official Supabase commit, source path, Git blob hashes, SHA256 values and literal extraction boundaries. `public_source.py` verifies the complete migration, preserved PostgreSQL license and exact 729-byte function body. The source is [Supabase postgres at 8b0ef1ef942e18493bf5c89087eff7b030c0e26d](https://github.com/supabase/postgres/blob/8b0ef1ef942e18493bf5c89087eff7b030c0e26d/migrations/db/migrations/20220321174452_fix-postgrest-alter-type-event-trigger.sql). No latest-version substitution, trimming or reconstruction is accepted.

Only the reviewed function body is installed in the disposable fixture. The complete upstream migration is preserved for provenance and is never executed; it contains unrelated DROP operations. Public source equality does not establish a deployment's owner, ACL, configuration, enabled mode, dependencies or operational permission.

The experiments use the exact canonical migration bytes, including its nested DO and both REVOKEs. The [PostgreSQL 17.6 event-trigger documentation](https://github.com/postgres/postgres/blob/REL_17_6/doc/src/sgml/event-trigger.sgml) supplies the engine's command/event matrix; runtime traces and state comparisons establish the observed behavior in this fixture.

## Evidence boundaries

Runtime cases are NOT_RUN until the matching Actions artifact confirms their assertions and cleanup. Offline contracts, static review and simulated listener checks do not supply PostgreSQL or notification results.

`event_cases.py` defines the expected matrix. A separate synthetic observer records command tags and execution context; the public handler's body is never instrumented. Independent LISTEN sessions and positive controls delimit notification observations. Tests exercise commit, rollback after insertion, existing registration and both synthetic RLS-bypass capability modes. All identities and serial IDs are measured from the owned fixture, and all rows are synthetic.

The observer and fixture do not reproduce an entire deployment or all extensions. Success does not certify arbitrary event handlers, unknown dynamic calls, consumers, external queues, pre-read appliers, transport behavior or owner ACL concurrency. F2 remains a limit. Unknown event policy and operational admission remain NOT_RUN/NOT_ADMITTED even when the public-handler experiments pass.

The seven operational-capture projections are also executed in read-only transactions with synthetic event triggers present. PowerShell's bundled Draft 2020-12 validator checks them against the unchanged projection schema. These are format, syntax and preservation checks, not operational admission.

`evidence.py` performs offline coherence checks through a required caller-supplied projection-schema validator. It never opens a connection, attests a target, proves a common snapshot or admits application. A coherent digest is not source authentication. Redacted history preimages that cannot be independently reconciled are rejected instead of reconstructed. Client-session visibility and non-client worker observations are reported separately; neither implies an empty queue or a DDL/ACL window.

`envelope.py` is an unconditionally aborting review proposal. Its first executable statement raises `CRM_OPERATIONAL_NOT_ADMITTED`; no flag can enable it. The later exact-byte payload demonstration is unreachable. It accepts only the public protocol marker, never private captures or credentials, and has no ledger DML. It is deliberately not a completed operational renderer. The existing lab renderer separately continues rejecting event-trigger profiles.

## Remaining implementation and operational gates

A real candidate still needs a separately reviewed private contract and comparator using the exact server-side projections. It must bind identities, all semantic commitments, role capabilities, event definitions and their complete reviewed call/effect graph. Only the two permitted helper ACL removals and their exact service-role dependency changes may normalize; removing complete ACL or privilege sections is not preservation.

The candidate must validate complete fresh ledger/default/sequence/index metadata, lock and recapture in a reviewed order, execute the unchanged payload, register exactly one default-generated Drizzle row and preserve Supabase history. Existing exact registration must verify all postconditions without repair, another DDL execution or sequence allocation. Rollback must distinguish transactional state from sequence gaps. The public proposal does not implement this missing operational registration/comparison protocol or manufacture private preimages.

Transport/session continuity, a timeout established before execution, commit and automatic-registration semantics, uncertain-response reconciliation, external writer/applier coordination and a newly authorized DDL/ACL window through independent postchecks remain separate gates. Neither an old window, a boolean assertion, statistical visibility nor a synthetic success supplies them. No real SQL, privilege change, deployment or merge is authorized by this lane.

## Reproduce offline checks

From the repository root:

```powershell
python -B -m unittest discover -s scripts/ci/crm-operational-events-review -p 'test_*.py' -v
```

Runtime execution is limited to the matching draft stacked PR workflow. Its artifact records the exact event head/base, public-source hashes, named checks, synthetic witnesses, limitations and resource cleanup. A successful runtime result requires the complete expected matrix and confirmed stopped/removed owned resources.
