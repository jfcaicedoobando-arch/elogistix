# Audit70 extension: reconcile CxP aging with invoice detail

> Antecedente de la fuente: los resultados siguientes pertenecen al candidato original, no certifican release43. Para la pila actual sobre42, alcance y reintegración tarifario pendiente, véase [plan43](audit70-aging-release43-application-plan.md).

Historical source validation. Current isolated split: [audit70-aging-forward-split.md](audit70-aging-forward-split.md).

Local delta based on accounting composition `4105f93b302b5b3e0209cbbf5de048626afb5ff3`.
No new finding number; the currency-only pass for audit45 is not a full reconciliation pass.

## Cause and correction

`cxp_aging_proveedores` aggregated nominal supplier-credit amounts. A USD116 invoice
with applied MXN2000 at stored TC20 was clamped to zero instead of retaining USD16.
The old implementation also fell back to nominal payment amounts if a frozen
invoice-currency payment amount was absent.

The aggregate now joins `v_proveedor_facturas_saldo`, the exact server balance
consumed by CxP invoice detail and its CSV. It does not subtract credit twice or
implement another conversion. It retains raw precision (including 0.945), applies
the existing >0.005 open threshold and grouping, and keeps current-balance
reclassification at the selected aging date. The JSON `saldo_factura_proveedor`
RPC is not substituted: it rounds each invoice to cents and has different
active-organization semantics.

No canonical view, FX helper, historical data, invoice membership, return shape,
or organization guard is changed. Missing conversions stay unknown in the
existing canonical calculations; existing `flujo_incompleto` behavior is unchanged.
This report still does not add an incomplete-valuation field to its return type.

The migration reasserts the existing EXECUTE ACL solely for H6 hygiene. Local
catalog capture verified the exact ACL, owner, search_path and SECURITY DEFINER
mode are identical before/after. No remote permissions or records were changed.

## Validation

- Fresh PostgreSQL17.9 squash/replay succeeded in an isolated loopback cluster.
- The new regression fails with the old RPC because the minimal invoice disappears.
- Fixed minimal case returns USD16 and one invoice.
- New NULL-safe SQL suite covers USD/MXN and EUR/MXN both directions, same currency,
  mixed stored rates, full/partial credit, ordinary payments, frozen advance
  precision, lifecycle/base distinctions, payment reversal, every bucket boundary,
  multiple reference dates, exact detail totals/counts and no invented FX.
- Existing suites passed: audit70_71_proveedor_nc_devoluciones, aging_nc_deleted_at,
  audit134_pago_congelado, audit134_anticipo_reclasificacion,
  audit134_anticipo_canon_consistente and audit139_cierre_cxp_neto.
- Reapplying the migration and rerunning the new suite passed.
- Frontend: 24 tests across four focused suites passed, including all four GUI
  fixture amounts 700+95+16+0.945=811.945 in detail and aggregate CSV.
- Changed-file ESLint, migration hygiene, canonical-schema and replay-mirror checks
  passed. RPC-sync static scan found no critical/high suspects.
- Release manifest remains intentionally unassigned and fails until the parent
  integrates the pending composition and assigns its release. Catalog RPC-column
  check was skipped in the ordinary static invocation because PGHOST was absent.
- No full application test suite, typecheck or production build was run for this
  SQL-only production change. Focused frontend checks concern test coverage only.
- Independent static review approved the production delta and hardened tests.

Only local source and isolated transactional fixtures were modified. No GitHub
push, PR, merge, remote SQL, historical backfill, deployment or GUI record edit.
