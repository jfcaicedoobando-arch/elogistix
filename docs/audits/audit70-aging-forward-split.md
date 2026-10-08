# Audit70: isolated Supplier Aging extension

> Antecedente de la fuente: los resultados siguientes pertenecen al candidato original, no certifican release43. Para la pila actual sobre42, alcance y reintegración tarifario pendiente, véase [plan43](audit70-aging-release43-application-plan.md).

Local candidate only. Parent: frozen-conversion134 `d95b8e7a6fd86cdbfa298f6743ae9daffe6db12f`.
Source delta: `81c4af4d12c47f4e92200cc3324c656d4d3cf547`; branch `split/audit70-aging-forward-local`.

Migration proposal: `20261007001600_audit70_aging_saldo_canonico.sql`.
SQL SHA-256: `1da271c012a2d62f2c4124064e9fc248766886dd0f6ed0fbc35ed971d9e99aea`. Its bytes are identical to the reviewed source migration; only the unpublished forward filename changes.

This RPC consumes `v_proveedor_facturas_saldo`, preserving document currency and exact frozen payment precision. USD116 minus applied credit converted toUSD100 leaves USD16. Credits remain separate from payments; `pagado` remains actual payment. No new FX lookup, guessed rate, historical rewrite or double subtraction is introduced. The existing RPC shape, organization contract and status/date semantics are preserved.

This branch is independent of139,148 and the P&L composition, and independent of the other70 extension. It does not change Por capturar62/130. The existing client fixture remains aligned with the source delta. Baseline changes only this RPC body, preserving all unrelated definitions and permissions.

Static migration, schema-function, replay-mirror and test hygiene checks pass. Fresh isolated PostgreSQL17.9 replay passed (288 migrations; one repository-designated production-data migration skipped), followed by eight ordinary suites which rolled back. The exact new RPC body matches the fresh snapshot. Its focused frontend fixture passed all3 tests, and ESLint passed without warnings. Parent coordinates release/timestamp/manifest before any publication. No application version, build, remote CI, SQL or deployment is claimed.

Inherited review correction:134 now preserves effective customer closure notes in Timbrada/Aplicada, with a new lifecycle/catalog fixture. This70 RPC, its SQL hash and frontend remain unchanged; no supplier lifecycle was broadened. Corrected fresh replay passed288 migrations and all9 ordinary suites, including the new customer NC preservation guard; the effective closure matches this baseline. Original artifacts are retained.
