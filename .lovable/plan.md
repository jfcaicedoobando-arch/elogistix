# Limpieza de docs/*.md

Revisé los 25 archivos `.md` del repo cruzando referencias desde `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `.lovable/plan.md` y entre los propios `docs/`. La mayoría siguen activos. Cuatro quedaron obsoletos: describen migraciones ya cerradas en versiones muy anteriores a la 11.69.0 y nadie depende de ellos para tareas vivas.

## Borrar (4 archivos, ~601 líneas)

| Archivo | Por qué se puede borrar |
|---|---|
| `docs/migracion-tabla-fase2.md` (141) | Crónica puntual de la migración a `@tanstack/react-table` cerrada en **v9.2.0**. Sólo se cita desde `datatable-columndef-guide.md` como "historia". |
| `docs/refactor-tanstack-summary.md` (215) | Resumen step-by-step del mismo refactor, cerrado en **v10.1.3**. Auto-declara que ya cumplió su rol. |
| `docs/datatable-perf-audit.md` (108) | Auditoría de perf de un solo disparo en **v10.1.2**. Los presupuestos vivos están en el test `DataTable.perf.test.tsx`. |
| `docs/linter-warnings.md` (24) | Snapshot de warnings del linter de Supabase en **v8.179.0**. Hoy se regenera con `supabase--linter` cuando hace falta. |

## Mantener (resto)

- **Vivos / referenciados en cleanslate 11.69.0:** `auditoria.md`, `cast-audit.md`, `power10-baseline.md`, `tests-audit.md`, `audit-cleanslate-11.69.0.md`, `architecture-map.md`, `strict-mode-roadmap.md`.
- **Guías operativas:** `tables.md`, `datatable-columndef-guide.md`, `operations.md`, `backups-rollback.md`, `security-checklist.md`, `integrations/jsoncargo-api.md`.
- **Raíz e infra:** `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `e2e/README.md`, `supabase/tests/rls/README.md`, `src/components/ui/README.md`, `reports/audit-report.md` (auto-generado), `.lovable/plan.md`.

## Ajustes de referencias

- En `docs/datatable-columndef-guide.md`: quitar el link a `migracion-tabla-fase2.md` (queda apunte a `CHANGELOG.md` v9.2.0 si se quiere preservar la historia).
- En `docs/refactor-tanstack-summary.md` ya no aplica porque se elimina junto con su único enlace a `datatable-perf-audit.md`.
- No hay referencias a `linter-warnings.md` desde otros docs.

## Versionado

- Bump patch: `appVersion.ts` → **11.69.1**.
- Entrada en `CHANGELOG.md` y `src/pages/Changelog.tsx`: "docs: poda de 4 MD históricos (tanstack fase 2, refactor summary, perf audit, linter warnings v8)".
- Sin cambios de código de aplicación.
