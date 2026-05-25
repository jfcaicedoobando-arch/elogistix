# Auditoría de código y tests faltantes

## Estado actual

- **Fuentes** (src, sin tests): ~732 archivos `.ts/.tsx`
- **Tests Vitest**: 69 archivos
- **Tests Deno (edge functions)**: 2 archivos sobre 11 funciones
- **Cobertura estimada**: ~9% por archivo (alta en `lib/*`, baja en `hooks/*`, `services/*` y `supabase/functions/*`)

### Bien cubierto

`lib/domain` (15/17), `lib/financial`, `lib/mappers`, `lib/parsers`, `lib/csv`, `lib/jsoncargo`, `lib/audit`, `lib/formatters`, `lib/ui`, `lib/validation`, `lib/storage`, `lib/supabase`, `lib/crm`, `hooks/auditoria`, `DataTable`, `permissions`, `changelog`.

### Gaps identificados

**P0 — Riesgo alto / lógica financiera/operativa crítica sin tests**

1. `services/facturas/huecoFacturacion.ts` — detección de huecos en numeración de facturas (compliance SAT).
2. `services/facturas/proyeccion.ts` — proyección de facturación (KPIs financieros).
3. `services/proforma/consolidar.ts` y `facturar.ts` — consolidación y conversión a factura.
4. `services/cliente/financials.ts` — saldos/estado de cuenta por cliente.
5. `services/admin/idempotencia.ts` — claves de idempotencia (riesgo de duplicación).
6. `lib/domain/embarque.ts` ya tiene tests, pero `services/embarque/queries/*` y `services/embarque/contenedor.ts` (BIC/grouping) no.
7. `supabase/functions/list-users` y `delete-user` — autorización admin (regresión reciente del 403).

**P1 — Hooks orquestadores con lógica pura extraíble**
8. `hooks/embarque/useEmbarqueSubmitOrchestrator.ts` — pipeline de creación (estado→inserción→eventos→docs).
9. `hooks/embarque/useEmbarquesFilters.ts` — filtros/derivaciones de lista.
10. `hooks/cotizacion/useCotizacionPL.ts` — P&L de cotización (margen, utilidad).
11. `hooks/facturacion/useHuecoFacturacion.ts` — pareja del servicio P0 #1.
12. `hooks/embarque/useTrackingLinks.ts` / `useJsonCargoBolLookup.ts` — construcción de enlaces externos.
13. `hooks/admin/useAdminOrgKpis.ts` — KPIs por organización.

**P2 — Utilidades menores y edge functions restantes**
14. `services/portal/queries.ts` y `columns.ts` (cliente final).
15. `services/observability/logClientError.ts`.
16. `supabase/functions/parse-csf`, `exchange-rates`, `jsoncargo-track`, `tracking-public`, `invite-client-user`, `client-error-log`, `auditoria-snapshot-daily`, `auditoria-weekly-digest`.

## Plan de ejecución sugerido

Tres tandas, cada una termina con `bunx vitest run` + bump de `APP_VERSION` + entrada en `changelogData.ts`.


| Tanda                                  | Alcance                                                                                                                                                           | Archivos test     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **A — P0 servicios + edge**            | huecoFacturacion, proyeccion, consolidar/facturar proforma, cliente/financials, admin/idempotencia, services/embarque/contenedor, list-users + delete-user (Deno) | 8                 |
| **B — P1 hooks con extracción**        | extraer lógica pura de submitOrchestrator, useEmbarquesFilters, useCotizacionPL, useHuecoFacturacion, useTrackingLinks, useAdminOrgKpis                           | 6 + 6 libs nuevos |
| **C — P2 utilidades y edge restantes** | portal/queries, observability, parse-csf, exchange-rates, jsoncargo-track, tracking-public, invite-client-user                                                    | 7-8               |


**Recomendación**: ejecutar **Tanda A** primero (mayor ROI, sin refactors) y luego decidir si seguimos con B y C.

## Detalles técnicos

- Vitest corre cada archivo en su propio worker (paralelismo ilimitado en la práctica).
- Tests Deno se ejecutan con `supabase--test_edge_functions` (`*_test.ts`).
- Para P1 se requiere extraer funciones puras a `src/lib/<dominio>/` siguiendo el patrón ya usado en `embarqueKpis.ts` y `desempenoChart.ts` — sin tocar UI ni features.
- Sin tocar `src/integrations/supabase/*`, `index.css`, `tailwind.config.ts`.

## Fuera de alcance

E2E Playwright, snapshot tests de UI, refactors fuera de extracciones mínimas para P1.

## Pregunta para el usuario

¿Arrancamos con **Tanda A**, **A + B**, o **las tres tandas** en este loop?

Las 3 tandas