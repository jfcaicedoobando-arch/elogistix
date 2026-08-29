# Limpieza de documentación (.md)

Hay 73 archivos `.md` fuera de `.lovable/`. La analogía: el proyecto acumuló "recibos" de auditorías ya aplicadas. Los recibos viejos se archivan o se tiran; los manuales de uso se actualizan.

## A) Borrar (histórico ya consumido, nadie los referencia salvo un índice)

Paquetes de parches de auditoría ya aplicados (615 KB en total):

- `docs/audit-fixes/FIXES_LOVABLE_COMPLETO.md` (387 KB, v13.523.1)
- `docs/audit-fixes/fixes_BL.md`, `fixes_FE.md`, `fixes_TC_N.md`, `fixes_UIA.md`, `fixes_UIB.md`, `fixes_UX.md`
- `docs/edge-functions/fixes_EF.md` (83 KB)

Snapshots de auditorías cerradas de versiones muy anteriores:

- `docs/architecture.md` y `docs/architecture-map.md` (ambos ya marcados "OBSOLETO", canónico = `ARCHITECTURE.md`)
- `docs/audit-tests-2026-06-08.md` (cerrado, v12.61.20)
- `docs/ui-audit/00-baseline.md` … `06-capa3-tranche-d.md` (v13.220–13.226); conservar sólo `99-resumen.md`
- `docs/refactor/dry-hooks-audit.md` (v13.226.0, conclusión ya aplicada)
- `docs/auditoria/visual-2026-08-24.md`, `visual-2026-08-24-erp.md`, `visual-uiux-2026-08-21.md`, `triage_uiux_r8.md`
- `docs/arquitectura-auditoria-3-status.md` (2026-07-23) y `docs/auditoria/cierre-auditoria-3-4.md`

Al borrar hay que quitar los enlaces correspondientes en `ARCHITECTURE.md` (sección de fix packs y `docs/auditoria.md` sigue vigente).

## B) Obsoletos pero sólo falta actualizar

- `docs/rls-multitenant-audit.md` — fechado 2026-06-08 / v12.61.11; hoy hay políticas RESTRICTIVE en 86 tablas y optimización InitPlan. Regenerar contra el estado vivo.
- `docs/security-checklist.md` y `docs/riesgos-aceptados.md` — reflejar las olas de hardening recientes.
- `docs/auditoria/backlog-v5-estado.md` — decía "36 corregidos · 9 con trabajo real"; marcar lo ya cerrado (N3/N4/N8/N20, N13).
- `docs/strict-mode-roadmap.md`, `docs/cast-audit.md`, `reports/*.md` — son generados por `scripts/` (`audit-casts.ts`, `audit-report.ts`, `coverage-report.ts`, `audit-rpc-sync.ts`): regenerarlos, no editarlos a mano.
- `README.md` / `ARCHITECTURE.md` — actualizar índice de docs tras el borrado y la versión mencionada.
- `roadmap.md` — sólo tiene tareas completadas; vaciar a lista limpia.

## C) Faltan (referenciados por scripts pero inexistentes)

`scripts/ga-gate.sh` exige `docs/rc-qa-checklist.md`, `docs/rc-perf.md`, `docs/release-notes-12.0.md`, `docs/ga-cutover.md`; y `scripts/audit-pagination.ts` genera `docs/pagination-audit.md`. Ese gate ya no aplica (era del release 12): recomiendo retirar esas comprobaciones del script en lugar de recrear los documentos.

## D) Dejar como están

`docs/design-system.md`, `datatable-columndef-guide.md`, `operations.md`, `observability.md`, `sentry-runbook.md`, `migrations-hygiene.md`, `backups-rollback.md`, `tables.md`, `auditoria.md`, flujos (`flujo-facturacion`, `flujo-anticipos-proveedor`, `flujo-aceptacion-cotizacion`, `embarques-contenedores`), `facturapi-*`, `ops/*`, `adr/`, `e2e/README.md`, READMEs de `supabase/`, `src/`, `scripts/`, `remotion/`, `CONTRIBUTING.md`, `.workspace/skills/*`.

## E) Aparte: `CHANGELOG.md` pesa 2.5 MB

No borrarlo (es requisito del proyecto), pero conviene mover lo anterior a la v13 a `docs/changelog-archive.md` y dejar el vigente ligero.

## Notas técnicas

- No se toca `.lovable/plan/` (256 archivos): lo archiva la plataforma automáticamente.
- Tras los borrados: `bun run lint`, `bunx vitest run src/__tests__ src/lib/__tests__` y `rg -n "docs/" -g '!*.md'` para confirmar que no quedan enlaces rotos.
- Cambios en 2 ediciones de versión: bump `APP_VERSION` + entrada en `CHANGELOG.md`.
