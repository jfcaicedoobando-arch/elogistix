## Objetivo

Subir cobertura real ≥ 38% sumando tests de **lógica de negocio pura** sobre los módulos fiscales nuevos (FacturApi, REP, NC, conversión proforma→factura) y servicios recientes sin tests. No tocamos código de producción.

## Estado actual

- Umbral `vitest.config.ts`: `lines/statements: 38, functions: 52, branches: 72`.
- El reporte MD (`reports/coverage-report.md`) está stale (v12.64.1, 29%). Política `mem://principles/coverage-threshold`: nunca bajar umbral; siempre escribir tests.
- Servicios fiscales NUEVOS sin test: `facturapi.ts`, `repFacturapi.ts`, `notasCreditoFacturapi.ts`, `facturaManual.ts`, `kpisFiscales.ts`, `descargarCfdiFacturapi.ts`, `enviarCfdiEmail.ts`, `datosFiscalesCliente.ts`, `facturasCrud.ts`, `dashboardEjecutivo.ts`, `masivas.ts`.
- Proformas sin test: `convertirAFactura.ts`, `asignarConceptos.ts`, `queries.ts`.
- Helper de observabilidad sin test: `src/lib/observability/fiscalBreadcrumbs.ts`.

## Plan de tests (lógica pura + servicios con mock Supabase)

Patrón: usar `src/test/utils/_supabaseChainMock.ts` para servicios y `vitest` puro para utilidades. Cero render de páginas pesadas (mejor ratio cobertura/esfuerzo).

### Bloque A — Servicios FacturApi (alto impacto)
1. `facturapi.ts.test.ts` — happy path emitir + branches de error (credenciales faltantes, factura ya timbrada, error 4xx FacturApi, organización sin RFC).
2. `repFacturapi.ts.test.ts` — emitir REP con un pago, varios pagos parciales, monto 0 inválido, cancelación.
3. `notasCreditoFacturapi.ts.test.ts` — emitir NC tipo "01 sustitución" y "02 devolución", validación de monto > factura origen.
4. `facturaManual.ts.test.ts` — creación con/sin proforma vinculada, cálculo de totales y validación de campos fiscales.
5. `facturasCrud.ts.test.ts` — list con filtros (fecha, estado, cliente), actualización de status, soft-delete.

### Bloque B — Conversión y proformas
6. `convertirAFactura.test.ts` — 1 proforma → factura, N proformas consolidadas, mezcla de monedas (rechazo), error si proforma ya facturada.
7. `asignarConceptos.test.ts` — asignación, reasignación, des-asignación, validación org.
8. `queries.test.ts` — filtros de búsqueda y paginación.

### Bloque C — KPIs y helpers fiscales
9. `kpisFiscales.test.ts` — conteo de facturas pendientes de timbrar, REP pendientes, NC abiertas, cero, sólo cancelados.
10. `descargarCfdiFacturapi.test.ts` — URL PDF/XML, manejo 404, propagación de errores.
11. `enviarCfdiEmail.test.ts` — validación destinatarios, payload correcto, error edge function.
12. `datosFiscalesCliente.test.ts` — resolución de uso CFDI, régimen, fallback a defaults.

### Bloque D — Observabilidad y dashboards
13. `fiscalBreadcrumbs.test.ts` — `addFiscalBreadcrumb` agrega categoría/level correctos y trunca data.
14. `dashboardEjecutivo.test.ts` — agregaciones por moneda, mes, top clientes.
15. `masivas.test.ts` — generación de payloads batch, filtrado de inválidas.

### Bloque E — Hooks delgados (sólo si A–D no cierran el umbral)
16. `useTimbrarFactura`, `useTimbrarRep`, `useNotaCreditoFacturapi`, `useCrearFacturaManual` — assertions con `assertMutation` (mutationKey, invalidateQueries, onError).

## Métricas y verificación

1. Antes: correr `bun run test:coverage` y registrar baseline real.
2. Implementar Bloques A–D (≈15 archivos, ~80–120 tests).
3. Volver a correr coverage. Si lines < 38%, agregar Bloque E.
4. Regenerar `reports/coverage-report.md` con `scripts/coverage-report.ts`.
5. Bump `APP_VERSION` + entrada en `CHANGELOG.md` (`## [13.137.16] - 2026-06-26` — "Tests de lógica fiscal para mantener cobertura ≥ 38%").

## Detalles técnicos

- Reusar `src/services/__tests__/_supabaseChainMock.ts` (patrón ya usado en `vsReal.bordes.test.ts`).
- Mockear `@/integrations/supabase/client` por archivo, nunca import real.
- Para FacturApi: stub `fetch` o el SDK envuelto en `src/lib/facturapi/*` (verificar punto de inyección antes de escribir cada test).
- Tests deben cumplir `Power of 10`, sin `any`, assertions fuertes (evitar `weak-rejects-assertion` que ya marcó CI).
- Cobertura objetivo: cada archivo nuevo de test debe sumar ≥0.3pp lines en su archivo target.

## Fuera de alcance

- No tocar páginas (`src/pages/**`) ni componentes UI grandes — su cobertura se persigue con E2E, no unitario.
- No modificar threshold ni excludes de `vitest.config.ts`.
- No editar el código de producción salvo extracciones triviales si un servicio resulta intestable (documentar caso por caso antes).
