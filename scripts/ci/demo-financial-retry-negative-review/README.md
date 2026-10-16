# Synthetic retry negative review: PREPARED / SQL NOT_RUN

This independent package adds only new files in this directory. It does not
change the engine, issuer, author runner, fixtures, functions, ACLs or workflows.
Connect it to the author's proposed fix at
`a7aff9ff8f92852687c56d3bc05d41150b44b2ae` (PR354). That exact HEAD is an
integration requirement, not a claim this package has executed its SQL.

| Case | Phase | Expected native denial | Boundary |
| --- | --- | --- | --- |
| foreign_bound_invoice_id | Fresh issuance | 23514 DEMO_FINANCIAL_ADOPTION_DENIED | RPC |
| authority_scheduler_disabled | Materialized retry | 42501 DEMO_SCHEDULER_APPROVAL_INVALID | RPC |
| authority_transport_disabled | Materialized retry | 42501 DEMO_REGISTERED_RPC_TRANSPORT_REQUIRED | RPC |
| tenant_organization_inactive | Materialized retry | 42501 DEMO_ORGANIZATION_INACTIVE | RPC |
| manifest_scheduler_hash_drift | Materialized retry | 42501 DEMO_SCHEDULER_APPROVAL_INVALID | RPC |
| expiry_run_shortened | Materialized retry | 42501 DEMO_RUN_UNAUTHORIZED | RPC |
| guarded_tenant_run_rebinding | Materialized | 42501 DEMO_IMMUTABLE_RUN | Mutation trigger; no retry call |
| mutable_supplier_origin_drift | Materialized retry | 23514 DEMO_ADMITTED_SUPPLIER_DRIFT | RPC |
| materialized_invoice_folio_drift | Materialized retry | PT409 DEMO_DOCUMENT_DIVERGED | RPC |

The collision uses the bound invoice ID from the authentic prepared receipt,
inserted through ordinary canonical triggers without a writer claim. It does
not mint a financial ID or replace immutable preparation evidence. Independent
concept-ID and payment-ID collision tests remain unprepared / NOT_RUN.

Changing the run tenant is rejected by its existing immutable-run trigger.
This is not cross-tenant retry coverage. A changed attested tenant cannot safely
reach the retry verifier under the pinned immutable evidence and tenant CHECKs;
`BLOCKED_CASES` records this limit. JWT changes would not supply that authority.

## Integration interface

Cherry-pick this independent commit into the author's checkout. Do not copy or
modify its sources. Load `suite.py` by path with `importlib.util`; it exposes
`CASES`, `BLOCKED_CASES`, `suite_sql`, `negative_sql`, and `inspect_result`.
The existing author runner owns installation and execution. This package has
no connection, DSN, Docker invocation, credentials or executable database CLI.

```python
spec = importlib.util.spec_from_file_location("retry_review", review_dir / "suite.py")
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
sources = {name: (author_sql_dir / name).read_bytes()
           for name in review.CONTRACT["external_sources"]}
sql_bytes = review.suite_sql(case_id, sources,
    author_fix_head="a7aff9ff8f92852687c56d3bc05d41150b44b2ae")
```

`contract.json` pins all three external fixture byte lengths and SHA256 hashes.
They were retrieved unchanged at the fix HEAD. The author must independently
verify its checkout/fix bytes and record the actual integrated commit. The HEAD
argument checks a declared version; it does not authenticate a checkout. A
subsequent source change requires an explicit contract review, not accepting a
new hash automatically. Exact Git bytes are required, including LF line endings.

For each case, create a **fresh owned synthetic database** using the existing
author runner: PostgreSQL17.6, network disabled, local socket, pinned image,
non-superuser candidate owner, synthetic technical role and authentic proposed
engine including `--proposal retry-corrected`. Keep the author's documented
laboratory manifest variant and before/after hashes. Do not run against another
session/database, real database, or another task's resources. Database name and
SQL guards do not establish container ownership; the runner must establish it.

Send the complete `sql_bytes` in **one psql session**, `-X -q -A -t`,
`ON_ERROR_STOP=on`, with SQL/echo-all disabled. The exact author fixture,
prepare-context and assertions bytes are prepended in order, including their
synthetic setup COMMITs. They must not be executed twice. `negative_sql(case_id)`
is the suffix-only alternative if the same session has already consumed those
three verified sources once. It requires a fresh issued, unmaterialized context.

Every materialized case first calls the genuine RPC and flushes real deferred
guards, then repeats the unchanged context successfully and proves identical
result/table rows. The known pre-fix adoption denial therefore fails the positive
precondition. No handler surrounds that positive control. Mutation and its proof
occur outside the expected RPC exception handler; a failed mutation cannot pass
as a negative denial. The handler accepts only the exact SQLSTATE and message.
After rejection it compares all table rows and manual sentinels, performs outer
ROLLBACK and compares the original prepared baseline again.

Call `inspect_result` with stdout/stderr/returncode from that same owned native
invocation. It requires ordered unique markers, no errors and zero exit status.
Its strongest result is `ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP`, never PASS
or operational admission. The author's adapter must preserve those logs, actual
source/SQL hashes and exact commit, prove owned cleanup after success or failure,
and then report bounded synthetic results. Do not infer native evidence from
fabricated sample marker streams in offline parser tests.

## Evidence limits and checks

`financial_snapshot` compares ordered full rows of r/p tables in five fixture
schemas. It excludes sequences, catalogs/ACLs, temp objects and the lab helper
schema. Snapshot equality proves table-row state, not absence of transient DML,
sequence gaps, complete catalog invariance or full ERP replay. This package
adds no business COMMIT; crash durability, deployment, operational admission,
external authentication, real transport and real RLS remain NOT_RUN.

Offline tests (no database):

```text
python -B -I -m unittest discover -s scripts/ci/demo-financial-retry-negative-review -p "test_*.py" -v
```

These check fixture rejection, case boundaries, exact canonical denial contracts,
canonical INSERT columns/triggers, and incomplete/error output handling. Native
SQL is prepared for author integration and remains NOT_RUN here.
