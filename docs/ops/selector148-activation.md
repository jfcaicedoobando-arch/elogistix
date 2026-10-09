# Selector148: activation candidate after destination admission

This is the minimal successor to the disabled selector registered in `20261009012000_audit148_integridad_selector_deshabilitado.sql`. It is prepared on the combined release53 source. This candidate is registered as release `13.824.54`, with an exact 1,511-migration manifest. The release53 and earlier records remain unchanged. It is not a claim that release53 is applied, that this candidate has passed remote Actions, or that AUD148 is closed.

## Immutable scope

- The historical installer, prior migrations, existing 65 structural cases and frozen fixtures remain unchanged. No Drizzle, package lock, permissions policy, business row, shared helper or financial formula changes.
- `20261009043000_audit148_activar_selector_autorizado.sql` retains the existing table locks and entire integrity precondition. It does not install, replace or validate constraints. Missing prerequisites abort before activation.
- Before replacement, the forward requires the exact disabled function body or its exact already-enabled body, owner `postgres`, PL/pgSQL/STABLE/SECURITY DEFINER properties, argument names/types/defaults, configuration and matching narrow effective ACL. Unknown source, configuration, owner or grants are rejected rather than repaired.
- The only executable function-body change is `_selector148_enabled` from false to true. The only new grant is EXECUTE to authenticated, without grant option. The same exact five application roles, existing read/write entitlements and active organization remain enforced inside the RPC. An enabled repeat is idempotent only when the complete enabled contract still matches.
- The response stays `items` plus a cursor. Each item has exactly `id`, `folio_interno`, `proveedor_nombre`, `subtotal` and `moneda`. Internal assignments, rejected candidates and diagnostic counts remain hidden. No other organization or role is admitted.
- The UI constant becomes true. Existing service and hook tests exercise the real release constant rather than overriding it to true. The separate disabled/rollback test explicitly mocks false and still verifies no RPC/table fallback.
- The canonical SQL mirror and baseline change only the same function literal and its authenticated grant. Baseline formatting follows the existing snapshot normalizer; the pinned PostgreSQL17.9 pre-fixture Actions snapshot remains authoritative.

## Destination admission, separate from activation

The release owner runs `scripts/db/selector148-admission-readonly.sql` against the explicitly approved project, separately from the forward. It uses REPEATABLE READ READ ONLY and `row_security=off`; that setting must raise an error if RLS would hide rows. It is not a bypass. No business record, organization ID, invoice ID or assignment is returned, only catalog facts, hashes and global integrity booleans.

For admission, preserve the result and verify:

1. Correct intended project/connection; read-only transaction; replication role origin; `row_security_off` and `all_graph_relations_rls_inactive` both true. The returned current/session users and superuser/BYPASSRLS attributes explain the observation's visibility.
2. `function_present`, `disabled_source_exact`, `metadata_exact` and `disabled_acl_exact` all true for first activation. For a documented idempotent repeat, require the exact enabled source and enabled ACL instead. Expected hashes are pinned in `scripts/ci/selector148/activation-contract.json`.
3. `six_fk_identity_and_enforcement_ready` true, including all six validated, nondeferrable, correctly shaped FK edges; all 24 exact active RI triggers; required unique keys; globally unique UUID PKs; ordinary noninherited tables; and the active-policy unique index.
4. Every `historical_edges` boolean, `historical_edges_clean`, `organization_columns_nonnull` and `active_policy_unique` true. The checks include every row, soft-deleted records and arbitrary numeric values, without filtering problematic assignments.

A missing function or missing FK means prerequisite installation is pending, even when all historical rows appear clean. No false/NULL/error result is admission. Install/apply the previously reviewed disabled prerequisite only through its independently admitted release, then rerun the read-only observation. Do not create the six constraints implicitly in the activation forward. A fresh observation is required just before application; prior clean results are not a lasting authorization to ignore drift.

The release owner remains the sole destination writer. The entire forward, including its pre/post guards and transaction, must be applied as one caller-owned unit. An interrupted, failed or ambiguous transport must be reconciled by read-only source/ACL and migration-ledger checks before retrying. There are no statement-wise fallbacks, partial ledger writes, business-data repairs or automatic deployment in this candidate.

## Exact-head CI gate

No new workflow or broad local suite is introduced. Use the existing `CI Success` and `RLS tests result` checks for the final published SHA, with the complete release54 manifest/version metadata in this composition.

- `static-check.cjs` still validates all frozen disabled inputs and now verifies the exact activation artifact. Removing just its two source/metadata/ACL guards and the superseded disabled-H6 comment reproduces the existing enable-only variant byte for byte. It checks canonical source, normalized baseline and enabled UI coherence.
- The serial runner loads that exact hash-pinned forward for all 65 existing structural enablement negatives, idempotent activation and both enabled lineages. Existing role, tenant, hidden-assignment, pagination, parity, six-writer races, cancellation and work-budget controls remain in the same owned disposable databases.
- Nine small source/owner/configuration/ACL/security/volatility drift cases verify rejection and preservation. One late failure after the real activation's grant verifies complete rollback to the exact disabled source and ACL.
- The main rollback manifest replaces only its disabled-state entry with `selector148_enabled_gate.sql`, preserving the manifest count. The original disabled SQL file remains frozen and still runs against serial disabled states.
- Existing pre/post generic-grant hooks already preserve the verified enabled or disabled ACL; they are unchanged. The new main guard requires the exact enabled body, full metadata and effective grants, so generic CI grants cannot hide activation drift.
- Full replay, all inherited guards/RLS suites, frontend tests/build/typecheck and the pinned schema dump must pass on the final SHA. Source review or old test evidence cannot substitute for that result.

## Publication and UI acceptance

Application must wait for real prerequisite admission and successful exact-head CI. Publishing source is not database admission, and a version label alone is not proof of application. Keep SQL source/ACL, baseline, UI artifact and recorded release SHA aligned. If the UI reaches an unavailable backend, existing generic error handling remains fail-closed with no direct-table fallback; that state is incomplete activation, not acceptance.

After the admitted database activation and matching UI delivery, validate the selector in the approved test organization under the already authorized business roles, verify active-organization switching and cancellation/retry behavior, and confirm no assignment details or additional headers appear. Preserve the final source/ACL/ledger observations and UI evidence before considering the selector accepted. Broader AUD148 closure still depends on its full audit acceptance criteria.
