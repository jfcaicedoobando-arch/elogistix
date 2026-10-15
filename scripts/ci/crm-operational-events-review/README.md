# Public event-handler experiments and inert delta review

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

`comparator.py` is an inert comparison of supplied before/after bundles. It checks the permitted helper ACL/dependency delta, unchanged scoped metadata and Supabase commitments, and the exact Drizzle row delta against a supplied measured `INSERT RETURNING` row. Separate outcomes cover successful registration, registered verification without allocation, and rollback after insertion with a sequence gap. It never connects, executes SQL, renders an application envelope or accepts an admission flag. Matching inputs do not establish that either capture is complete, authentic, independently approved, refreshed under locks or from the same execution transaction. Every result remains NOT_ADMITTED.

The additional owned-fixture comparator cases use complete server-generated projections and an actual offline Draft 2020-12 validator. Their registration witness comes from the real synthetic default/RETURNING path. Reduced offline test doubles are separately labelled and cannot stand in for those schema/runtime checks. Runtime results are NOT_RUN until the corresponding current-head artifact confirms them.

The offline comparison API is `compare(before_bundle, after_bundle, outcome=..., returned_row=..., validate_projection=...)`. Both bundles use the complete existing nine-key review protocol. `outcome` is exactly `applied`, `registered_read_only` or `rolled_back_after_insert`. The applied and rollback observations require the actual three-field `RETURNING` object with integer `id`/`created_at` and string `hash`; registered verification forbids a returning row. The supported sequence observation is the ordinary ascending `int4` serial convention with increment/cache one and no cycle. Unknown default semantics still require separate review even when references and observed arithmetic match. Nothing in this API requests an ID, allocates it or admits execution.

`envelope.py` is an unconditionally aborting review proposal. Its first executable statement raises `CRM_OPERATIONAL_NOT_ADMITTED`; no flag can enable it. The later exact-byte payload demonstration is unreachable. It accepts only the public protocol marker, never private captures or credentials, and has no ledger DML. It is deliberately not a completed operational renderer. The existing lab renderer separately continues rejecting event-trigger profiles.

## Remaining implementation and operational gates

The [minimum private contract specification](private-contract-spec.md) defines the exact existing projection fields, review order and permitted postimage. Its field list is not an approved policy or window.

A real candidate still needs a separately reviewed private contract and transaction-bound comparator using the exact server-side projections. The offline delta comparison does not bind its inputs to an actual execution or supply semantic approval. Operational review must bind identities, all semantic commitments, role capabilities, event definitions and their complete reviewed call/effect graph. Only the two permitted helper ACL removals and their exact service-role dependency changes may normalize; removing complete ACL or privilege sections is not preservation.

The candidate must validate complete fresh ledger/default/sequence/index metadata, lock and recapture in a reviewed order, execute the unchanged payload, register exactly one default-generated Drizzle row and preserve Supabase history. Existing exact registration must verify all postconditions without repair, another DDL execution or sequence allocation. Rollback must distinguish transactional state from sequence gaps. The public proposal does not implement this missing operational registration/comparison protocol or manufacture private preimages.

Transport/session continuity, a timeout established before execution, commit and automatic-registration semantics, uncertain-response reconciliation, external writer/applier coordination and a newly authorized DDL/ACL window through independent postchecks remain separate gates. Neither an old window, a boolean assertion, statistical visibility nor a synthetic success supplies them. No real SQL, privilege change, deployment or merge is authorized by this lane.

## Reproduce offline checks

### Review private files locally

`offline_review.py` is a local file adapter for the inert evidence/comparison APIs. Run it from a complete checkout of the reviewed public commit. It verifies all 22 inherited public source pins before reading private inputs. It performs no SQL, opens no database connection, installs nothing and downloads nothing. Keep the input envelopes, manifest and returning witness on a local filesystem outside the checkout and outside Actions; this repository receives none of their contents. The adapter emits only sanitized statuses/reason codes and never writes an assembled bundle or derived private postimage.

Create a private file map with exactly these nine keys. This map uses the bundle kind but contains file paths rather than envelopes; it is not itself an evidence bundle. Paths are relative to the manifest directory or absolute local paths. Include every actual page file in `supabase_pages`; the filenames below are illustrative.

```json
{
  "kind": "crm-operational-review-bundle-v1",
  "discovery": "01-discovery.json",
  "catalog": "02-catalog.json",
  "drizzle_history": "03-drizzle-history.json",
  "supabase_manifest_before": "04-manifest-before.json",
  "supabase_pages": ["05-page-0001.json", "05-page-0002.json"],
  "supabase_manifest_after": "04-manifest-after.json",
  "sequence_state": "07-sequence-state.json",
  "activity": "06-activity.json"
}
```

Each file contains either the exact projection envelope or the exact SQL-result wrapper `{"rows":[{"crm_evidence":<envelope>}]}`. Duplicate JSON keys, unexpected wrappers, truncated data and ambiguous values fail closed. The adapter orders page files by their validated offsets without modifying any page rows or catalog arrays. The evidence API then checks exhaustive offsets/row numbers, ordering, counts, commitments, formatting settings and before/page/after manifests. A coherent page set still does not authenticate its hidden SQL preimages or a common transaction snapshot.

```text
python -B scripts/ci/crm-operational-events-review/offline_review.py review --manifest /private/capture/manifest.json --validator auto
```

The validator uses an already installed Python `jsonschema` Draft 2020-12 implementation or local PowerShell `Test-Json`. It verifies the pinned local schema and refuses external references; no dependency is installed on demand. Missing validation support yields a sanitized failure. Review checks the canonical helper preimage and supported ledger/sequence structure, derives the permitted catalog postimage in memory and classifies exact existing registration versus absence/conflict. It does not fabricate a future capture record, migration row or ID.

To check real observations after an independently authorized execution, use separate complete before/after file maps and the actual three-field returning witness. The adapter itself executes nothing:

```text
python -B scripts/ci/crm-operational-events-review/offline_review.py compare --before-manifest /private/capture/before.json --after-manifest /private/capture/after.json --outcome applied --returning /private/capture/returning.json --validator auto
```

Use `registered_read_only` without `--returning` for verification without allocation, or `rolled_back_after_insert` with its measured returning witness for a rollback observation. A passing result remains NOT_ADMITTED and supplies no authorization to create those observations. The parent can return the sanitized JSON report for review and retain every private input locally.

Exit zero means only that the supplied review observations matched; exit two means blocked/rejected. The returning file is the exact three-field row object, optionally wrapped as `{"rows":[<row>]}`. Raw default/binding definitions are separate private semantic-review evidence and must not be inserted into the strict projection bundle.

### Minimum remaining gates

The parent can check file/schema/page integrity now, retain the complete private preimage, finish independent definition/history/event-route review and report only sanitized results. The parent can also prepare and test the still-missing transaction-bound comparison/registration envelope and verify transport/session continuity, timeout, commit, automatic-registration and uncertain-response reconciliation semantics in an isolated environment. Those are implementation/review tasks; an operational window does not supply them.

A newly authorized user-coordinated DDL/ACL window is separately required for actual application: exclude relevant owner/DDL/ACL writers and external appliers/retries, refresh and review the required contract inside that window, keep exclusion through commit verification and postflight, and stop on drift or contention. Use the actual default/RETURNING row and perform read-only reconciliation before any retry after an uncertain response. The closed historical window is never reusable. Current code has no operational application mode, and this preparation procedure does not authorize real SQL or removal of either fence.

### Run public synthetic unit contracts

From the repository root:

```powershell
python -B -m unittest discover -s scripts/ci/crm-operational-events-review -p 'test_*.py' -v
```

Runtime execution is limited to the matching draft stacked PR workflow. Its artifact records the exact event head/base, public-source hashes, named checks, synthetic witnesses, limitations and resource cleanup. A successful runtime result requires the complete expected matrix and confirmed stopped/removed owned resources.
