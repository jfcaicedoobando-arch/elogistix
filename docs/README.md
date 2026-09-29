# Documentación de Libre Carga

Índice revisado el **2026-09-29** contra `main`.
Las guías describen código versionado; no certifican el estado de Live.

## Empezar

| Necesidad | Documento |
| --- | --- |
| Instalar/ubicar stack | [README](../README.md) |
| Capas y estructura | [Arquitectura](../ARCHITECTURE.md) |
| Proponer/verificar cambios | [Contribución](../CONTRIBUTING.md) |
| Workflows y checks actuales | [CI](ops/ci.md) |
| Build/pruebas/shards | [Stack](stack-mantenimiento.md), [mediciones](ci-vitest-shards.md) |
| Tipos/casts | [TypeScript](strict-mode-roadmap.md), [reporte generado](cast-audit.md) |

## Diseño y flujos

| Tema | Guías |
| --- | --- |
| UI compartida | [Diseño](design-system.md), [tablas](tables.md), [ColumnDef](datatable-columndef-guide.md) |
| Cotizaciones y embarques | [Conversión](flujo-aceptacion-cotizacion.md), [contenedores](embarques-contenedores.md) |
| Facturación/IVA | [Flujo](flujo-facturacion.md), [FacturAPI](facturapi-go-live.md) |
| FacturAPI Test/Live | [Ambientes](facturapi-ambientes.md), [Sandbox E2E](facturapi-sandbox-e2e.md), [sustitución](facturapi-sustitucion.md) |
| Compras/dinero | [Aprobación CxP](flujo-cxp-aprobacion.md), [anticipos](flujo-anticipos-proveedor.md) |
| Auditoría operativa | [Capas del módulo](auditoria.md) |
| Auditoría visual automatizada | [Guía](../scripts/visual-audit/README.md) |
| Pruebas navegador | [Playwright](../e2e/README.md) |

## Backend y operación

- [Higiene SQL](migrations-hygiene.md), [espejos](../supabase/schema/README.md).
- [Baseline](ops/baseline-esquema.md), [divergencias toleradas](ola14-replay-mirror-saldo.md).
- [RLS efímero](../supabase/tests/rls/README.md), [manifiestos](../supabase/releases/README.md).
- [Operaciones/restore](operations.md), [referencia rápida](backups-rollback.md).
- [Observabilidad](observability.md), [runbook Sentry](sentry-runbook.md).
- [Seguridad](security-checklist.md), [higiene .env](ops/purga-env-git.md).

## Historial y decisiones

- [CHANGELOG](../CHANGELOG.md) y archivos [v13](changelog-archive-v13.md) /
  [anteriores](changelog-archive.md): historia de releases, no manual de API actual.
- [ADR red](adr/ADR-001-network-error-handling.md): intención arquitectónica.
- [ADR Vite 6/Vitest 4](adr/vitest4-vite6.md): transición histórica,
  sustituida por el stack actual; no instrucciones de instalación.
- [Backlog QA v5](auditoria/backlog-v5-estado.md): cierre histórico, no cola actual.
- [RLS 2026-08-29](rls-multitenant-audit.md): snapshot de esa fecha, no auditoría de hoy.
- [Riesgos aceptados](riesgos-aceptados.md): decisiones/evidencia fechada que requieren revisión.
- [Pendientes históricos por verificar](auditoria/pendientes-historicos.md):
  no se cerraron ni se ejecutaron al retirar planes.
- [Roadmap](../roadmap.md): dónde registrar trabajo aprobado.
- [Campañas](pre-ads-checklist.md): checklist de planificación, no campaña activada.
- `.lovable/memories/`: reglas persistentes de features/diseño, contrastadas
  con sus fuentes; no órdenes para implementar automáticamente.

## Limpieza del 2026-09-26

Se retiran los **131 planes temporales de `.lovable/plan/`** y dos snapshots
generados de `reports/` que ya estaban ignorados por `.gitignore`.
No eran guías canónicas; mezclaban instrucciones de un lote, mediciones
antiguas y propuestas de datos. Las reglas duraderas permanecen en guías/memorias.
Los pendientes que no se pueden cerrar desde código se conservan como
**por verificar**, no como bugs nuevos ni solucionados.

La copia exacta de todo lo retirado es recuperable en el commit anterior:
[b4d86b7](https://github.com/jfcaicedoobando-arch/elogistix/tree/b4d86b7c010b6f8f528f695df0c707b06db030f1).
No se reescribe Git ni se borran changelogs, SQL, pruebas o datos.

Reportes pueden regenerarse con `audit:report` / `audit:rpc-sync`.
Los resultados generados no deben trackearse si son snapshots reemplazables.
Una auditoría que consulta DB debe identificar entorno/fecha y autorización;
un resultado viejo no certifica Live.

## Revisión del 2026-09-29

Se actualizó la guía de conversión de cotizaciones y la memoria persistente
de Lovable para documentar que una tarifa sustituta con recargos positivos
no incluidos en la cotización aceptada bloquea la conversión y exige
recotización/aprobación. La corrección está en Git; la guía separa ese hecho
del estado de despliegue de producción.

En el inventario, todas las guías de `docs/` (excepto este propio índice)
están enlazadas aquí. No aparecieron rutas Markdown rotas en las guías
revisadas ni documentos actuales sin referencia. **No se eliminó ningún
archivo**: los changelogs, ADRs y auditorías cerradas son registros históricos,
y los documentos operativos restantes están referenciados. La limpieza del
2026-09-26 ya retiró los planes temporales de Lovable.

## Cómo mantenerla

Actualizar la guía canónica cuando cambie contrato, ruta, versión de stack
o procedimiento. Evitar duplicar defaults/conteos: enlazar configuración.
Separar hechos observados, propuestas e historial.
Eliminar una guía sólo después de revisar consumidores/referencias.
Docs-only no cambia versión del ERP ni publica frontend.
