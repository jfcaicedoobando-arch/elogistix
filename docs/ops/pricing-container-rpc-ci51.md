# Direct pricing RPC container guard: candidate 13.824.51

## Contract

The frontend guard already merged into main does not prevent a direct
`crm_aplicar_tarifa_tarifario(uuid,uuid)` call. This forward adds the reviewed
container predicate to that existing RPC, before its compatible-idempotent
return. No new callable helper, catalog rewrite, retrospective repair, RLS
policy, role or access is added.

`tipo_carga` remains authoritative; `container_size` is used only for a blank
primary value. Known size and category in catalog name/code must each agree,
including partial fields. HC/HQ and Dry aliases remain compatible; dry/HC,
wrong sizes, contradictory fields and empty normalized keys fail closed.
Unknown custom types retain normalized-name-first equality. Existing tenant,
requester/creator/pricing-role, request-state and tariff-expiry behavior stays
in place. A compatible already-selected expired tariff stays idempotent, with
no history rewrite; an incompatible historical link cannot bypass the guard.

## Immutable source and installer

- Forward: `20261009014000_pricing_container_rpc_guard.sql`.
- Reviewed ASUS draft SHA256:
  `9c1c1871d7f365fa1981a5cec3b28bfdf0f5fe53f76ea07578dbdeeb9295c98f`.
- Exact predecessor `prosrc` SHA256:
  `2ec27dcc73f65c294b5d147d4eb4c2aaebef89f4000233c99bdc624076d0cf6d`.
- Exact guarded `prosrc` SHA256:
  `30f6bf09d3098b3494ca1655b3dac6cfa1f71e185d5fbff1fa4117735a77b97e`.
- Canonical mirror: `supabase/schema/crm/crm_aplicar_tarifa_tarifario.sql`.

The function body is byte-exact to the corrected reviewed draft. The new outer
installer accepts only the known predecessor or the identical guarded body,
with postgres ownership/execution identity and exact signature/language/
security/search-path/volatility/strictness/parallel/cost attributes. The direct
ACL must already consist of postgres, authenticated and service_role EXECUTE,
all granted by postgres with no explicit grant option; PUBLIC/anon must be
closed. This comes from the historical explicit grants in
`20261006234000_replay_tarifario_pricing.sql`, never from CI blanket grants.
Missing, extra or changed privileges are rejected instead of repaired.

The same existing DCL is reaffirmed only after those checks. Postconditions
compare the entire non-body pg_proc row, raw/expanded ACL, effective privileges
for all roles, OID and expected body. A caller-owned stop-on-error transaction
is mandatory: SAVEPOINT rejects autocommit before persistent changes. There is
no BEGIN/COMMIT takeover. Drizzle0010, replay/mapping, all prior migration bytes
and historical manifest entries stay unchanged.

## CI-only verification

The existing RLS prepare step enables `PRICING_CONTAINER_CI=1` and invokes
`scripts/ci/pricing-container/test-envelope.mjs` immediately before this exact
migration. The runner requires GitHub Actions, postgres and a loopback service;
it refuses database URL/service overrides. It clones only the actual
pre-installer schema into uniquely named databases and drops only its own clones.

Twenty controls are authored: first/second apply; pre-harness catalog check;
caller rollback; autocommit refusal; unknown body; absent target; PUBLIC/anon/
extra-role exposure; missing authenticated/service_role grant; grant option;
changed owner, SECURITY INVOKER, search_path, volatility, strictness or cost;
and injected postcondition failure. Failed runs must match their specific
error and preserve full database-dump and target-catalog hashes. Runner logs
and cleanup evidence are always uploaded. This is not a remote DB entry point.

`_ci_check_pricing_container_acl.sql` runs after replay but before
`_ci_post_migrate.sql` so harness grants cannot hide a missing historical grant.
The auto-discovered rollback suite `test_rls_pricing_container_guard.sql` ports
57 calls to the actual replay schema, real organization memberships, real
triggers and actual authenticated database role. It does not replace auth.uid,
org_scope or _crm_es_pricing. It checks full request equality on rejection and
compatible retries, selection/timestamps on success, role/tenant boundaries,
expiry/state, missing/deleted requests, missing tariffs, canonical/raw aliases,
primary/legacy precedence and the corrected partial-field contradictions.

Mock-only NULL tariff-type and invalid cancelled-tariff fixtures are not copied:
the real schema's NOT NULL/FK/state checks stay enabled. A missing-tariff case
exercises the same absent-join rejection; non-current tariffs use legal
`borrador` state. Only isolated fixture DML uses the existing internal state
flag, cleared before each authenticated invocation. No live/customer records
or secrets belong in these tests.

## Baseline strategy and remaining evidence

The candidate baseline is a bounded structural projection: retain the inherited
native-17.9 dump header/order/ACL and replace only this RPC's body, applying the
existing snapshot script's blank/comment-line normalization. It is NOT an
executed regeneration and carries no new runtime claim. The existing blocking
baseline gate must compare it against native pg_dump inside the pinned
PostgreSQL17.9 service before fixtures. If formatting differs, inspect the
exact CI dump/diff and update only the intended object; never weaken the gate.

No local SQL, full test suite or production migration was run for this package.
Static migration/mirror/manifest/fixture/wiring checks are separate evidence.
Exact-head GitHub Actions must still establish installer controls, replay,
pre-harness privileges, real baseline, RLS cases and the inherited mandatory
checks. CI success does not prove backend deployment. Before any future target
application, verify that target's ledger/body/owner/ACL/attributes and the
caller's whole-file transaction behavior. This package authorizes no database
application, deployment or fiscal action.
