# Required cases before v2 approval

Status definitions: **implemented / not run** means SQL was prepared, not that it
compiled or passed. **pending v2** is a required case without executable SQL yet.
No pending row may become a success by omission, a NOTICE, a missing fixture,
`IF EXISTS` skip, broad exception handler, false/NULL assertion, or a mock RPC.

## Implemented baseline-neutral cases, not run

The 12 exact IDs in review-contract.json are emitted only after assertions:

1. Authenticated DB role with no subject: conversion rejects 42501 / LC_SESION_REQUERIDA.
2. Another tenant's operations manager: acceptance rejects 42501 / LC_NO_AUTORIZADO.
3. Non-admin creator: acceptance rejects 42501 / LC_SOD_VIOLATION.
4. Seller: client conversion rejects 42501 / LC_CLIENTE_SIN_PERMISO, before idempotency.
5. Internal client, authorization disabled, no CRM: real acceptance seals version/user/time.
6. Same internal acceptance retry: returns same version, no rows changed.
7. Expired internal quote: exact LC_COT_VENCIDA, no partial writes.
8. Non-prospect Borrador without client: exact LC_COT_SIN_CLIENTE, no writes.
9. Internal-client CRM quote: real canonical RPC/trigger seals version, one winner,
   canonical subtotal, won stage and exactly one acceptance/closure audit and notice.
10. CRM acceptance retry: no row changes, including accepted time/user/version,
    original winner, value and notifications.
11. Second quote of that opportunity: LC_COTIZACION_GANADORA_EXISTE, not raw 23505;
    full quote/CRM/client/audit/notification/shipment/invoice snapshot unchanged.
12. Divergent quote/opportunity currencies: LC_MONEDA_INCOMPATIBLE, same rollback.

## Pending v2: complete ordered prospect journey

Use a qualified CRM prospect with an actual `crm_empresas` record linked through
`crm_oportunidad_empresa` to a live same-org opportunity and live lead. Verify
all IDs from actual table definitions. Capture the real lead/company state after
each production trigger fires, rather than setting the expected final state by
fixture UPDATE.

- Borrador eligible prospect: reject first acceptance if v2 confirms Enviada-only.
- Solicitada eligible prospect: reject first acceptance under the same contract.
- Enviada eligible prospect without client: actual authenticated
  `aceptar_cotizacion_version`, sealed current version, current user and timestamp,
  canonical subtotal/winner/currency, CRM won exactly once.
- At this checkpoint no client exists, `cliente_id` remains NULL and
  `es_prospecto=true`; lead becomes `Pendiente de alta` through the real
  `_crm_lead_avanzar_por_cotizacion`; linked company remains `Prospecto`.
- An acceptance retry before client conversion recognizes the exact same valid
  winner and complete seal, even though the lead has advanced to Pendiente de alta.
- Actual ORIGINAL `convertir_prospecto_a_cliente_rpc` then creates/reuses client,
  changes lead to Convertido and linked company to Cliente through the real
  trigger, links quote/opportunity/lead consistently and logs conversion once.
- Conversion retry returns same ID, `sin_cambios=true`, zero re-linked quotes,
  no new client/audit/notification and unchanged original acceptance seal.
- Acceptance retry after conversion remains idempotent. Do not derive a changed
  historical origin or version merely from a later client configuration change;
  characterize current semantics and ask the reviewer if v2 does not specify it.
- A separate internal existing-client path must keep no-CRM acceptance working.
  Test both authorization=true and false according to existing state rules.
- Sending the quote, acceptance and conversion are separately asserted; a UI
  refetch mock cannot stand in for persistence or a canonical SQL call.

## Pending v2: eligibility, roles and tenant failures

For each, assert exact SQLSTATE/stable code and full snapshot rollback:

- No session / malformed missing subject under authenticated; anon EXECUTE denied.
- Current viewer-equivalent/customer, salesperson, operations manager and admin roles tested according to
  real role rules; legacy operador/viewer/admin inserts remain rejected. User membership must belong to the target organization.
- Non-admin creator SoD, distinct authorized acceptor, allowed admin override.
- Non-prospect missing client, prospect without opportunity, nonexistent/deleted
  opportunity, cross-org opportunity, missing/deleted/cross-org lead,
  unqualified or already-conflicting lead, missing/deleted/cross-org company,
  company not genuinely linked to the opportunity, already-converted or
  conflicting client links, lost opportunity requiring explicit reopening.
- Active-tenant mismatch for super_admin must be checked against actual org_scope
  and v2's intended semantics; existing acceptance must not be assumed equivalent
  to conversion's explicit is_org_member + rls_tenant_scope_ok checks.
- Omit or mutate each predicate individually; no broad blanket failure counting.
- Retry authorization occurs before returning `sin_cambios`; conversion permission
  never grants acceptance permission and the reverse is not assumed.

## Pending v2: version, expiry and legacy fail-closed cases

- Current and accepted version equal at first seal; accepted user/time non-NULL.
- Version >1; current version vs immutable accepted version/snapshot tested.
- Expired Enviada rejected before any write; expiry boundary CURRENT_DATE.
- Accepted replay with matching winner but missing accepted version/time/user;
  mismatched accepted version or conflicting snapshot according to reviewed v2.
- Legacy accepted without client/opportunity/lead/winner must not fake success.
- Accepted retry must validate post-acceptance lead state, not only pre-state.
- En operación without client must not become a new exception unless explicitly
  approved. Conversion requires accepted state; no fake shipment is created.
- Concurrent stale front-end state does not change canonical server version.

## Pending v2: currency, fiscal and invoicing

- Same currency MXN and USD; real subtotal helper, values/rounding preserved.
- Mismatched CRM currency fails without writing seal/winner/audit/notice.
- Supported/unsupported concept currencies use actual canonical guards.
- Fiscal conversion payload missing each required field; correct stable code,
  no created/reused client or changes to quote/opportunity/lead/company.
- Generic domestic/foreign RFC vs actual RFC, whitespace/case normalization,
  existing live same-org RFC reuse, deleted/cross-org RFC not accidentally reused.
- Same company name with distinct opportunity must not re-link unrelated quotes;
  same-opportunity live historical prospect quotes should re-link exactly once;
  deleted or cross-org history stays untouched.
- Before conversion, real shipment/proforma/invoice conversion guards reject
  insufficient customer/fiscal identity. Call actual entry points with their
  production roles and required fixtures; no invented helper signatures.
- After fiscal conversion, test the authorized draft downstream boundary only.
  No PAC/network/timbrado, real invoice issuance/payment or production contact.
- Existing `_assert_receptor_fiscal_valido` behavior must be tested with actual
  receiver fields and dependencies. Acceptance must not waive fiscal validation.

## Pending v2: catalog, rollback and observable events

- Exact allowed function body delta; no changes to OID, owner, ACL, SECDEF,
  search_path, policies, indexes, guards or original conversion function.
- Preserve auth.users FKs and actual authenticated SQL role for every RPC.
- Inject a failure through a test-only failing trigger at each late boundary
  (after quote seal/CRM close, client creation, lead update, activity insertion),
  scoped to synthetic IDs and rolled back in the owned database. Never replace a
  business helper with `RETURN true` or suppress a trigger to reach the branch.
- Assert full atomic rollback and that original retry subsequently succeeds.
- Exactly one CRM win notice for a real seller and exactly one audit each.
  `count <= 1` is insufficient because zero would pass.
- UI toast/cache-refetch duplication stays in UI integration tests; DB tests prove
  persisted CRM notification/audit uniqueness, not browser toast behavior.
- Deliberately corrupt an assertion to prove the suite goes red; remove only that
  owned canary and rerun exact final SQL. A false-green helper is release-blocking.

## Evidence gate

Publish exact source/head/base/image digest/server version, before/after catalog,
case IDs, SQLSTATE/messages, rows/winner/snapshot equality, actual two-session lock
observations, stdout/stderr, cleanup success and all skipped/not-run cases. Final
v2 success requires the explicit complete inventory; the baseline's 12-case
inventory alone can never satisfy it. Use PostgreSQL 17.9 for the normal baseline
and RLS gate in addition to the separate PG17.6 diagnostic.
