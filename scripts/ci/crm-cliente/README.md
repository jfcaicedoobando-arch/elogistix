# CRM client identity

The independent `crear_clientes(jsonb)` route creates a separate CRM company for
each new client. Display names, including exact homonyms, never identify an
existing company.

The canonical prospect conversion resolves all explicit opportunity/lead company
IDs before customer insertion, rejects conflicting identities, and locks company
then lead then quotation/opportunity. This preserves PR 366's company-first order.
It rechecks tenant, current deletion state and unassigned/equal client under the
lock. A generated client UUID is reserved on that exact company in the same
subtransaction as the INSERT. The schema currently has no FK on
`crm_empresas.cliente_id`; no FK is removed or deferred. RFC conflicts roll back
the reservation and then validate/bind the reused client. No caller GUC is used.

The company guard rejects deleted customer companies on INSERT and UPDATE, and
prevents clearing/replacing an acquired client or demoting Cliente before a later
delete. Lead state propagation skips deleted companies. There is no backfill,
historical migration edit, data cleanup or change to KAM bodies/ACL/attribution.

The retired lead conversion and propagation RPCs retain their existing bodies and
service-only ACL. Tests use the currently authorized authenticated routes.

## Verification

```sh
python3 scripts/ci/crm-cliente/test_static.py -v
```

Runtime runs in `rls-tests.yml` before broad grants or FK relaxation, reusing the
existing PR 366 adapter and its exact PostgreSQL 17.9 service, isolated opt-ins,
two owned clones, source fingerprints, OID/owner checked cleanup and unchanged KAM
function metadata. It accepts no database URL or caller SQL. The only adapter
extension is an evidence-directory constant.

The resolver retains the original opportunity links before dependent waits and
compares the complete identity set after those waits, including disappearance.
A non-null company lead must match the opportunity lead; a null origin is allowed
when the explicit opportunity link supplies identity. New or changed lead claims
take the same lead row lock as conversion, preventing a late company from
appearing inside that transaction. Authenticated claims revalidate the live
tenant/lead and reject an already converted lead. Privileged historical mirror
producers retain their existing attribution contract and still serialize on the
lead when it exists. KAM creator/ID protection and RPC bodies remain unchanged.

The committed cases cover independent homonyms without old-row contention,
different legal/display names, RFC reuse, retry with physical snapshots,
same-identity double conversion, association/delete in both commit orders,
true KAM/conversion in both orders, deleted/cross-tenant/ambiguous/conflicting
destinations, contradictory origin lead, original-link deletion, three-session
dependent waits, late lead claims (with and without an explicit company), and
incompatible NEW plus clear/demote/delete state.
Lock-dependent cases require an actual `pg_blocking_pids` barrier.
Offline source contracts do not constitute runtime evidence.


## Historical replay and current catalog are separate evidence

Drizzle 0034 evolves conversion to support a Borrador prospect and prevents newly
sending/accepting that prospect before customer creation. Reapplying the older
identity migration to that final catalog is a real downgrade, not idempotent
replay. The exact fingerprint failure must therefore remain enforced.

The original whole-migration runner now runs in the isolated replay checkpoint
immediately before 0026, after 0021–0023 and the canonical chain. Missing/failed
checkpoint evidence aborts preparation. It retains the accepted-quote fixtures,
complete migration replay, two owned clones and exact source fingerprints.

`run-final-actions.py` is a dedicated current-catalog verifier, not a replay.
It does not execute the historical migration or replace any function. It pins
0034 and 0041 bytes and their isolated mirrors. The conversion RPC stays at
0034; only the quotation trigger advances to 0041, permitting historical
housekeeping while preserving the prospect commercial-transition guard. It
compares all eight effective identity
function bodies plus owner/security/search_path/ACL, and retains the exact KAM
contract. Its two owned clones run the same 19 identity/concurrency cases using
Borrador fixtures. Blocking barriers and all identity/row assertions are shared;
only the quote's initial stage differs. Source data/catalog fingerprints and
clone catalog/security are preserved, with owner/OID-checked teardown.

Evidence stays separate in `reports/crm-cliente-concurrency/` (historical) and
`reports/crm-cliente-final-concurrency/` (current). `verify-evidence.py both`
requires the same source commit, two successful dropped clones per stage and
all 19 named cases; it cannot label verify-only as migration replay.

Local validation after this correction used fresh official PostgreSQL 17.9 on
loopback, without Docker: both stages ran two real clones,19/19 cases each,
including committed races and actual lock barriers. Historical replay left the
exact fingerprint unchanged and both source catalogs/data were preserved.
Current source bodies/ACL matched 0034. This is local SQL evidence, not a claim
that the Actions container adapter ran locally; the complete pinned-container
workflow still requires its remote run. No application data, product migration,
margin setting or real/project database was modified.

### Current contract correction (0041)

The final replay applies 0041 after 0034. The verifier now independently pins
that trigger definition without executing SQL or relaxing metadata checks.
Offline regressions reject the stale 0034 trigger, altered 0041 source/mirror,
unexpected definitions and each existing security/ACL drift. The earlier local
0034 runtime evidence above is historical, not validation of this correction.
The updated runtime stage is `final-0041-verify-only`; its fresh Actions run
is required before claiming current runtime success. No migration is changed.
