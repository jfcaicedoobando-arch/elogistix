# Audit134: frozen application conversion, isolated from139

Reviewed behavioral source for the prepared release40 package. Original local provenance is retained below; see [audit134-release40-application-plan.md](audit134-release40-application-plan.md) for the current prerequisite and application boundary. No remote application or publication is implied.

## Inputs and final contract

- Parent: audit131 `5ee14bb7fe421562ccd1d8dab29f549babbe9928`, itself after audit135 `0211458`.
- Source behavior: reviewed composition `6b0b362`; source134 stages `da43a07`, `176b466`, `feac743` supply provenance, not a blind sequence to publish.
- Branch: `split/audit134-frozen-forward-local`.
- Migration: `20261006235700_audit134_pago_congelado.sql`.
- Current SQL SHA-256: `9bcbbf4166368dc95f1a7e64290658001af59a81ca27ca10164e443a2b6480a2`. The original reviewed134 source hash was `9d0fea4d796f95bb72ecd6d88694164c00d4c0a670b8cc0fe9c27453329d30b6`; the one-expression refund-reference preservation below supersedes it.

The unpublished intermediate134 migrations are replaced here by one final effective implementation. Applied advances use their persisted `monto_en_moneda_factura`; NULL remains unknown even when a separate payment exchange rate exists. A stored zero is known. Ordinary payments retain the existing converter. No current DOF lookup or historical backfill is introduced.

Both statement legs of cross-currency reclassification depend on a known destination amount. This moves credit between currency balances without creating a new payment or bank movement. Same-currency applications stay informative. The existing Pagada shortcut is preserved except for the narrow missing-frozen-application case. Canonical balance continues to report incomplete flow.

## Closure boundary

The old source134 snapshots already included part of139 because of their development order. They cannot be copied wholesale into this prerequisite.

This candidate changes only payment conversion and unknown-payment detection in main's closure function. A small payment aggregate supplies both known payments and an unknown flag with the same selector. Invoice membership remains main's direct-header membership, and debt aggregation stays main's existing behavior. It does not add credit-note netting, cross-shipment allocation, quantity membership, partial/over-allocation capping or139 UI copy.

Audit139 will replace that function with its reviewed final allocation-aware body in the next candidate. The unchanged structural frozen-conversion test still requires exactly two closure selector calls and unknown-conversion blocking; it is not relaxed to admit a partial conversion implementation.

## Prerequisites and release plan

Audit131 is required for supplier-statement refund metadata. Audit135 remains in the stack and its chronology/idempotency body is unchanged. No policy148 or P&L change is included. Existing function permissions remain as before; the new pure conversion helper has the same reviewed authenticated/service_role whitelist and no table access.

Apply the target-history and body-comparison procedure from [audit135-forward-split.md](audit135-forward-split.md). This timestamp follows131 and proforma35's coordinated SQL, but remote histories remain unverified. Assign the release/manifest only through parent coordination. A remote function that has moved ahead must be reconciled, never overwritten using this local snapshot merely because replay passes.

## Validation

Static migration hygiene, schema-function integrity, canonical replay mirrors and test hygiene pass. The existing exact schema divergences are retained. Fresh PostgreSQL 17.9 replay passed: 287 migrations, one repository-designated production-data migration skipped. All eight ordinary suites passed and rolled back: the three134 suites, refunds131, chronology135, cash/application-date FX, no duplicated bank movement, and payment reversal. The four effective normalized baseline functions match the fresh replay. The unchanged pure structural suite verifies117 conversion combinations plus mismatch/unknown cases and consistent consumers. No build, full CI, browser or remote execution is claimed.

## Review correction: preserve the effective customer-credit lifecycle

The source canonical closure file was stale relative to the effective131 replay: main's immutable AUD-ANALISIS-7 migration already includes Timbrada and Aplicada customer notes. The initial134 replacement accidentally narrowed the monetary CxC detail to Aplicada only. This follow-up changes exactly that customer predicate in the new unpublished134 definition, canonical mirror and baseline. Supplier notes are unchanged and remain Aplicada only. No historical migration was edited.

A new ordinary invoice/credit fixture checks Borrador, Timbrada, Aplicada and Cancelada, reconciling total/payment/credit/residual against saldo_factura and proving the read does not change invoice or note facts. An effective-function catalog guard prevents a later full-definition replay from silently narrowing the lifecycle again. Revalidation is recorded in the correction evidence; original commits/logs/snapshots are retained under accounting-cxc-preservation-202610070055.

Correction verification: fresh replay287 and nine ordinary suites passed. The new fixture passed on the effective131 definition, failed on the preserved original134 definition with Timbrada credit detail0 versus saldo92.80, and passed after the corrected definition. The regenerated snapshot matches the canonical/baseline body. No TypeScript changed.

## Release 40 correction: preserve the final refund reference from corrected39

Corrected131 commit `22e65c29a2ed2ab4bab45c7253e31367975e883e` changes the final supplier-statement refund projection: when `medio_devolucion` is known, `referencia_devolucion` is authoritative even if NULL; only legacy rows retain the fallback to the original advance reference. Otherwise, a bank-funded advance returned as cash could inherit the bank reference after this134 redefinition.

The same single CASE expression is now carried in the134 migration, canonical statement and baseline. All other134 SQL bytes remain identical to the reviewed source. The strengthened131 fixture checks new cash NULL, explicit cash/bank references and the legacy fallback in all three reporting consumers. The exact-function selector regression from corrected39 is also inherited without relaxing its accounting assertions. SQL131 now has SHA-256 `9e1d651b437aaa05a04a71dfb9b95eda35343bc32b3f9dd84f22520af292d2af`. No remote SQL was applied; this unpublished package replaces its earlier candidate, not an installed migration.
