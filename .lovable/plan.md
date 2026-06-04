## Contexto

El proyecto está en `12.53.8`, pero muchos `.md` siguen anclados a hitos cerrados hace meses (RC 12.0, cleanslate 11.69.0, integración JSONCargo) o referencian código que ya fue removido. Este plan separa lo que se borra, lo que se actualiza y lo que se deja intacto.

## A. Eliminar (obsoletos / código ya removido)

| Archivo | Motivo |
|---|---|
| `docs/integrations/jsoncargo-api.md` | JSONCargo no existe en el repo (no quedan edge functions ni imports). 1738 líneas de referencia muerta. |
| `docs/deprecation-jsoncargo.md` | La deprecación ya se ejecutó; el inventario de "qué borrar" está cumplido. |
| `docs/ga-cutover.md` | Checklist específico del corte `12.0.0-rc.1 → 12.0.0`, ejecutado hace 53 minors. |
| `docs/rc-perf.md` | Plantilla de smoke-test del RC 12.0, ya consumida. |
| `docs/rc-qa-checklist.md` | Checklist QA del RC 12.0, ya consumido. |
| `docs/release-notes-12.0.md` | Notas del RC 12.0, superadas por el `CHANGELOG.md` vivo. |
| `docs/templates/ga-announcement.md` | Plantilla de comunicado del GA 12.0; el corte ya ocurrió. |
| `docs/audit-cleanslate-11.69.0.md` | Snapshot puntual de v11.69.0 (versión cerrada). |
| `docs/cast-audit.md` | Reporte autogenerado por `scripts/audit-casts.ts`; se regenera bajo demanda. |
| `docs/tests-audit.md` | Snapshot v11.69.0 de la suite de tests. |
| `docs/pagination-audit.md` | Reporte autogenerado por `scripts/audit-pagination.ts`. |
| `docs/inline-styles-audit.md` | Auditoría puntual 12.2.0, ya integrada como regla en `mem://principles/inline-styles`. |
| `docs/power10-baseline.md` | Baseline de v11.69.0; las reglas vivas están en `mem://principles/power-of-10`. |
| `reports/audit-report.md` (+ `reports/audit-report.json`) | Reporte autogenerado por `scripts/audit-report.ts`; se regenera bajo demanda. |
| `.lovable/plan.md` | Plan de landing ya implementado y publicado. |

Carpetas que quedan vacías tras la limpieza: `docs/integrations/`, `docs/templates/`. Se eliminan también.

## B. Actualizar (vigentes pero desactualizados)

| Archivo | Cambio |
|---|---|
| `README.md` | Corregir el link al changelog (`./src/pages/dashboard/Changelog.tsx` ya no existe) — apuntar a `./CHANGELOG.md`. Quitar referencia a `docs/auditoria.md` si el módulo Auditoría sigue vigente (verificar en sección C). |
| `ARCHITECTURE.md` | Reemplazar el encabezado "Última revisión: v11.59.1" por la versión actual y borrar los conteos absolutos (716 tests, 109 archivos) que envejecen mal; dejar referencia a `mem://technical/architecture-and-standards` como fuente viva. |
| `docs/architecture-map.md` | Quitar el preámbulo "v11.60.0 tras cierre de Bloques A y B" y dejarlo como mapa atemporal de dominios. |
| `docs/strict-mode-roadmap.md` | Quitar la referencia muerta a `cast-audit.md` (que se elimina) y dejar el roadmap como guía viva. |
| `docs/backups-rollback.md` | Quitar la fecha "v8.178.0" del encabezado; el contenido del runbook sigue siendo válido. |
| `docs/auditoria.md` | Quitar el ancla a `docs/audit-cleanslate-11.69.0.md` (que se elimina). |

## C. Dejar intactos (siguen vigentes)

- `CHANGELOG.md` — fuente viva, no se toca.
- `ARCHITECTURE.md` — sólo el refresh del encabezado.
- `docs/operations.md` — runbook activo de super_admin.
- `docs/security-checklist.md` — checklist trimestral.
- `docs/tables.md` — estándar vigente de `DataTable`.
- `docs/datatable-columndef-guide.md` — contrato `ColumnDef`, vigente desde 10.0.0.
- `docs/embarques-contenedores.md` — modelo 1↔N actual.
- `docs/flujo-aceptacion-cotizacion.md` — flujo vigente del portal.
- `docs/auditoria.md` — módulo activo.
- `e2e/README.md` — guía de Playwright.

## D. Changelog y versión

- Bump `APP_VERSION` a `12.53.9`.
- Entrada en `CHANGELOG.md`:
  - `docs(cleanup) — eliminados 15 documentos obsoletos (JSONCargo, RC/GA 12.0, snapshots de auditoría v11.69.0/12.15.0) y refrescados encabezados de README/ARCHITECTURE/auditoria/strict-mode/backups.`

## Validación

- `rg -l "jsoncargo|cast-audit|audit-cleanslate-11.69.0|ga-cutover|rc-perf|rc-qa-checklist|release-notes-12.0|inline-styles-audit|pagination-audit|tests-audit|power10-baseline|ga-announcement"` debe devolver vacío después del borrado (sin referencias rotas).
- Inspección visual de los enlaces internos en los `.md` que sobreviven.

## Fuera de alcance

- No se tocan archivos en `mem://` ni `src/`.
- No se tocan los scripts en `scripts/` que generan los reportes eliminados (siguen funcionando; los reportes simplemente no se versionan).
