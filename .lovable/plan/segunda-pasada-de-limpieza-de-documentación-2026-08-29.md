# Segunda pasada de limpieza de documentación

La limpieza grande ya se hizo en v13.793.0 (docs/ bajó de 1.9 MB a ~173 KB).
Quedan 320 archivos MD; 258 de ellos son planes archivados. Esta pasada cierra
lo que sobrevivió y quedó desalineado con el estado vivo (v13.794.0).

## A. Borrar (obsoletos, sin valor vivo)


| Archivo                              | Por qué                                                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ui-audit/99-resumen.md`        | Cierra una auditoría visual de v13.220–v13.226 (julio). Los otros archivos del ciclo (`00-baseline.md`, lotes) ya se borraron; este quedó huérfano. Hay que quitar también su referencia en `ARCHITECTURE.md`. |
| `.lovable/tablet-audit-report.md`    | Reporte puntual de 2026-07-05 (v13.17x). Ya existen specs E2E responsive (13, 14, 15, 16, 18, 19) que cubren el mismo invariante de forma automática.                                                          |
| `.lovable/audit-erp-completeness.md` | Comparativa contra Odoo/SAP fechada 2026-07-05 sobre v13.172.11; el inventario de features cambió por completo. Nadie la referencia.                                                                           |
| `reports/coverage-report.md`         | Congelado en v12.64.1 (2026-06-08), ~200 versiones atrás. Se regenera solo con `bun run test:coverage`; mantener el archivo viejo desinforma.                                                                  |
| `reports/strict-mode-baseline.md`    | Baseline previo a activar `strict: true`. El objetivo ya está cumplido y documentado en `docs/strict-mode-roadmap.md`.                                                                                         |
| `docs/crm-mapeo-hunter.md`           | Mapeo de columnas del Excel "Hunter" para la migración inicial del CRM; la migración ya se ejecutó y el CRM se rediseñó después (lead/prospecto/oportunidad).                                                  |
| `remotion/CLAUDE.md`                 | Instrucciones para otro agente (Claude Code), no para este proyecto ni para el equipo.                                                                                                                         |


## B. Actualizar (útiles pero desalineados)


| Archivo                             | Qué corregir                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ola14-replay-mirror-saldo.md` | Dice que el baseline tolera **14** divergencias; hoy `scripts/audit-replay-mirror-baseline.json` tiene **2**. Actualizar el número, listar las 2 entradas vivas y el criterio para cerrarlas. |
| `.lovable/audit-todos.md`           | Sólo queda `AUDIT-M16` (`.env` en el índice de git). Verificar si sigue siendo cierto y, si sí, apuntar a `docs/ops/purga-env-git.md` en vez de repetir el procedimiento.                     |
| `docs/ops/purga-env-git.md`         | Confirmar que el contenido refleja el `.env` actual y marcar fecha de última verificación.                                                                                                    |
| `docs/pre-ads-checklist.md`         | Checklist de landing/atribución sin marcas de estado. Añadir columna hecho/pendiente para que se pueda usar.                                                                                  |
| `docs/cast-audit.md`                | Generado el 2026-08-29 con 3226 casts; coincide con `reports/audit-report.md`. Sólo agregar la nota de que es artefacto generado (no editar a mano).                                          |
| `README.md`                         | Ajustar el índice de documentación quitando lo borrado en A.                                                                                                                                  |
| `roadmap.md`                        | Quitar el pendiente de `reports/coverage-report.md` (se borra en A).                                                                                                                          |


## C. Se quedan tal cual

`ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/design-system.md`, `docs/tables.md`,
`docs/datatable-columndef-guide.md`, `docs/auditoria.md`, `docs/operations.md`,
`docs/observability.md`, `docs/security-checklist.md`, `docs/riesgos-aceptados.md`,
`docs/rls-multitenant-audit.md`, `docs/migrations-hygiene.md`,
`docs/backups-rollback.md`, `docs/sentry-runbook.md`, los flujos de negocio
(`flujo-facturacion`, `flujo-aceptacion-cotizacion`, `flujo-anticipos-proveedor`,
`embarques-contenedores`), los de FacturApi, `docs/adr/ADR-001`,
`docs/auditoria/backlog-v5-estado.md`, los `README.md` de `e2e`, `supabase/*`,
`src/components/ui`, `src/lib/domain`, `scripts/visual-audit`, `reports/audit-report.md`
y `reports/rpc-sync-audit.md`.

## D. Planes archivados y CHANGELOG (decisión aparte)

- `.lovable/plan/` tiene **258** planes archivados (~1.2 MB). Son bitácora  
histórica y no molestan al build, pero puedo archivarlos por mes si quieres  
reducir ruido en el árbol. Si
- `CHANGELOG.md` sigue en **2.2 MB / 13 028 líneas** porque cubre todo el
ciclo v13 (de `13.0.0` a `13.794.0`). Se puede archivar lo previo a, por
ejemplo, `13.500.0` en `docs/changelog-archive.md`. **Sólo si lo autorizas**,  
porque toca la fuente de verdad de versionado. Si

## Cierre

Bump de `APP_VERSION` a `13.795.0` + entrada en `CHANGELOG.md` describiendo la
limpieza. Sin cambios de código productivo, así que no hay riesgo funcional.