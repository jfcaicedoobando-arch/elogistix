# Audit139: final attributed closure debt

Local candidate only; no release number, publication, remote SQL or deployment.

## Provenance

- Parent: `d95b8e7a6fd86cdbfa298f6743ae9daffe6db12f` (final isolated134).
- Reference: reviewed composition `6b0b362`, final139 correction `4105f93`.
- Branch: `split/audit139-attributed-debt-local`.
- Migration: `20261007001300_audit139_cierre_saldo_atribuido.sql`.
- SQL SHA-256: `7f40c34ea4441ab144602f1f2c5d268543cad1f881de312a91ed66ef4cc0b0e3`.

Only the final effective closure function is published in this candidate; no intermediate139 snapshot. It depends on134's frozen-payment selector and retains it in both known-payment and unknown-payment paths. The final body matches the reviewed composition.

## Business contract

Positive effective supplier allocations determine shipment membership. Quantity is applied once, NULL/zero use the established quantity-one convention, and negative quantities do not create membership or reduce the denominator. Deleted costs and budget adjustments are excluded. Header membership is fallback only when no effective allocations remain.

Invoice gross amount, actual payments, applied credits and per-invoice nonnegative residual all use the same attribution factor. Partial assignment is not expanded; overassignment is capped against the larger of invoice subtotal and total assignment. Payments and credits remain invoice-level facts: this computes a proportional share without manufacturing payment-to-shipment history.

Unknown payment or credit conversion still blocks closure, and the existing0.01 tolerance is evaluated per currency. The formatter exposes proportional attribution and conversion warnings. No invoice, payment, credit, allocation or historical policy row is rewritten by the function.

Main's audit140 evidence copy is preserved; its already-present changes are not copied into this PR. The formatter's shortened header keeps its size within the200-line auditor limit (199 physical lines) without suppression. No P&L, policy or Por capturar change is included.

## Validation and next gate

The parent135/131/134 stack passed serial app/node TypeScript checks at `3bd41e8`, with a3GB heap and incremental output disabled. Static migration hygiene, schema integrity, mirrors and test hygiene pass here. This candidate's fresh PostgreSQL17.9 replay passed (288 migrations; one designated production-data migration skipped). All eight suites passed and rolled back: three139 allocation/debt suites, three134 frozen-conversion suites, refunds131 and chronology135. The baseline function exactly matches this fresh replay. Twenty frontend tests across the formatter and existing140 evidence copy passed, plus changed-file ESLint. All checks ran serially without a build.

Apply the release/history/body-check procedure in [audit135-forward-split.md](audit135-forward-split.md). This timestamp follows the independently proposed62/130 timestamp001000; no dependency on that consumer is introduced. Root coordinates final ordering of all unpublished migrations and application releases. The manifest remains intentionally unassigned until that decision; no guard is relaxed.

Review preservation fix: this unpublished139 definition retains the effective base customer-credit lifecycle Timbrada/Aplicada in the CxC monetary detail. Both supplier amount and unknown-FX predicates remain Aplicada only. The new ordinary lifecycle/reconciliation fixture and effective-function guard are inherited from corrected134; no historical migration or unrelated closure rule changed. Original commits/snapshots are retained for traceability.

Correction verification: fresh replay288 and nine ordinary suites passed, including the new customer lifecycle/amount guard and the unchanged139 supplier-state lifecycle suite. This verifies customer Timbrada/Aplicada while supplier Borrador/Aprobada/Cancelada still do not reduce debt. The regenerated snapshot matches the corrected canonical/baseline body; TypeScript is unchanged.

## Empaquetado posterior42

La asignación de release ya se coordina en [audit139-release42-application-plan.md](audit139-release42-application-plan.md). Ese plan usa41 corregido como padre, conserva esta fuente funcional exacta y reemplaza el estado histórico «manifest unassigned» para el paquete42. Los resultados locales antiguos de esta página no son resultados de la composición42 ni prueba de revisión independiente.
