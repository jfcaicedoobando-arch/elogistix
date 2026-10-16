# Origin snapshot correction, provider version 2

Historical native run [38826041062](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38826041062)
at author HEAD `21b5fae8e9fb7e072f21ae9478e0f6df6d7e4f35` remains **7 PASS,
2 FAIL before mutation**. Both affected cases completed genuine materialization
and unchanged retry, then their snapshot construction failed with `42703:
column a.identity_receipt_id does not exist`. Their intended negative denials
were NOT_RUN. No prior file, result or artifact is rewritten by this correction.

The old `_origin_snapshot("a.identity_receipt_id")` referred to the outer
`demo_flow_writer.server_admissions a`. Its preparation-admission scalar query
introduced another `a`, hiding the outer relation. Authentic
`demo_fixture_identity.preparation_admissions` has no `identity_receipt_id`.

`origin_materialization_cases_v2.py` imports the pinned original and derives only
the two affected cases by exact expression substitutions. Each nested relation
now has an explicit `origin_prepared_receipt`, `origin_preparation_run`,
`origin_preparation_admission` or `origin_preparation_binding` alias. Snapshot
keys, rows, joins, ordering, outer receipt references and rejection contracts
stay the same. No canonical SQL engine/issuer/fixture is replaced.

| Corrected case | Native denial still required |
| --- | --- |
| mutable_supplier_origin_drift | 23514 DEMO_ADMITTED_SUPPLIER_DRIFT |
| materialized_invoice_folio_drift | PT409 DEMO_DOCUMENT_DIVERGED |

`suite_v2.py` preserves the nine original IDs/order and all existing guards.
Seven rendered SQL suffixes are byte-identical to version1. For each affected
case it replaces exactly one mutation and two proof fragments, and inserts one
read-only schema-binding probe after successful positive retry and before the
mutation. The probe evaluates both corrected receipt references against the
author-installed authentic typed tables, compares the complete four-part origin
snapshot with independent reads, and validates the existing receipt chain. It
does not create schema/rows, change settings, call a writer or add grants.

Probe failures remain uncaught preparation failures. `inspect_result` additionally
requires exactly one `RETRY_ORIGIN_V2_SOURCE_BOUND_<case>` marker between the
positive retry and mutation markers. Missing, duplicated or reordered markers
cannot produce a negative PASS. Expected SQLSTATE/message and table-row rollback
gates remain the original ones. No sequence rollback or business COMMIT is claimed.

## Author handoff

This corrective commit can be cherry-picked onto the author's integration of
`fd3a2fcb940dc122fda7be242afda05a053dd61d`; supplemental commit `7d38dc8ad` is
not a runtime dependency. The correction adds files only. Its standalone
`origin-v2-contract.json` pins all nine original files and records the historical
failure; it does not require the supplemental delivery lock or provider.

The author owns adapter changes. Explicitly select
`scripts/ci/demo-financial-retry-negative-review/suite_v2.py` instead of
`suite.py`, and record the corrective review SHA plus actual integration SHA.
Update the adapter's source inventory/pins and their expected count for the
actual selected package contents; do not bypass exact inventory checks or edit
the old source/evidence to satisfy them. `CASES`, `BLOCKED_CASES`, `CONTRACT`,
`suite_sql`, `negative_sql`, `expected_markers` and `inspect_result` retain the
original interface. Native result metadata adds `review_provider_version=2` and
the source probe result.

Use the same reviewed author fix `a7aff9ff8f92852687c56d3bc05d41150b44b2ae`
and the exact three external fixture byte arrays. The author must run the new
version in its fresh owned synthetic PostgreSQL17.6 instances, preserving source,
installation, rendered SQL and cleanup evidence. No local runner, DB connection,
DSN, credential, browser, deployment or real database action is added here.

## Regression evidence and remaining gate

Offline tests derive relation column sets from pinned authentic `bridge.sql`,
`producer.sql` and `16-owner-registry.sql` CREATE TABLE declarations. A bounded,
independent snapshot binder reproduces the historical nearest-alias failure with
42703, accepts both corrected references, and rejects unknown-column/captured
alias mutants. It does not pretend to execute arbitrary PostgreSQL. Integration
tests also load only the first nine files plus the new provider/contract in a
disposable directory, proving the correction does not depend on the supplement.

The embedded native probe is the executable regression against the installed
authentic schema. **Its execution and the two corrected denials remain NOT_RUN
here.** The new evidence file records offline results and rendered hashes only.
A fresh author-owned native run must establish the corrected result; historical
7 PASS/2 FAIL evidence cannot be relabelled as successful acceptance.
