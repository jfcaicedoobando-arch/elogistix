# CRM client identity

The independent `crear_clientes(jsonb)` route creates a separate CRM company for
each new client. Display names, including exact homonyms, never identify an
existing company.

The canonical prospect conversion resolves all explicit opportunity/lead company
IDs before customer insertion, rejects conflicting identities, and locks company
then lead then quotation/opportunity. This preserves PR366's company-first order.
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
existing PR366 adapter and its exact PostgreSQL 17.9 service, isolated opt-ins,
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

