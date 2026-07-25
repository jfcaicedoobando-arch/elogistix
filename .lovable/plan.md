# Plan: Performance — 20 ítems en 4 olas

Ejecutar el documento `instrucciones-lovable-performance-2026-07-25.md` completo, respetando las reglas globales (no tocar guards de dinero salvo P13 con tests SQL, formatters solo en `src/lib/formatters`, hooks compartidos en `@/hooks/shared`, patrón de referencia = Embarques, `VirtualDataTable` para listas 100+, migraciones idempotentes sin `CONCURRENTLY`, sin librerías nuevas). Cada ola es un "PR" (commit lógico) con `APP_VERSION` bump + entrada en `CHANGELOG.md`.

## Analogía

Es como afinar un carro: primero cambias filtros baratos (Ola 0), luego optimizas el motor (Ola 1), después la transmisión (Ola 2), y al final ajustes finos (Ola 3). No mezclar olas.

---

## Ola 0 — Quick wins (P1–P6)

1. **P1** — Caché de `Intl.NumberFormat` en `src/lib/formatters/numbers.ts` (Map por moneda) + test de idempotencia.
2. **P2** — CxP `/compras/facturas`: `useMemo` para columnas, `useDebounce(search, 300)`, paginación server-side (100/pág), un solo `TooltipProvider`, KPIs memoizados.
3. **P3** — `TesoreriaConciliacion.tsx`: migrar tabla plana a `VirtualDataTable` (mantener `.limit(2000)`).
4. **P4** — Vista SQL `v_saldos_cuentas_bancarias` (security_invoker) + refactor `resumen.ts` y `agregador.ts` a una sola query por snapshot.
5. **P5** — Migración con 10 índices `IF NOT EXISTS` (org/FK) en clientes, bbva_movimientos, conceptos_*, proveedor_*, factura_embarques, embarques.
6. **P6** — Sentry dinámico (dynamic import) en `ErrorBoundary.tsx` y `reportFeedback.ts`.

## Ola 1 — Paginación & agregación server-side (P7–P10)

7. **P7** — Bandeja Facturación usa `fetchFacturasListado` con page/pageSize server-side (pageSize=100).
8. **P8** — RPC `eerr_resumen_anual(p_year, p_fuente)` que reemplaza 14 llamadas del `agregador.ts` + paralelizar tesorería/flujo.
9. **P9** — `CREATE OR REPLACE` de `cxc_aging_clientes` y `cxp_aging_proveedores`: JOIN a facturas para filtrar por `v_org` en CTEs (conservar filtro `deleted_at` en NCs). Test SQL de aislamiento por org.
10. **P10** — `CREATE OR REPLACE` de `profit_por_embarque()`: JOIN a embarques filtrado por org. Test SQL 2 orgs.

## Ola 2 — Medios (P11–P16)

11. **P11** — `ResponsiveDataTable`: usar `useIsMobile()` para renderizar una sola rama (móvil o desktop), no ambas ocultas por CSS.
12. **P12** — `@react-pdf/renderer` bajo demanda en handlers (dynamic import + spinner "Generando PDF…").
13. **P13** — Trigger `recalcular_estado_factura`: calcular SUM de pagos una sola vez y reutilizar. **Obligatorio:** tests SQL `cxc_guard_sobrepago.sql`, `guard_estado_factura.sql` verdes + casos nuevos (pagada exacto, parcial, borrado lógico).
14. **P14** — RPCs `dashboard_direccion_kpis`, `facturacion_tendencia_6m`, `crm_resumen_abiertas` reemplazan loaders que bajan >30k filas.
15. **P15** — Cotizaciones paginada server-side (50/pág); Proformas: columnas explícitas + paginación.
16. **P16** — Wizard cotización: reemplazar `form.watch()` por `useWatch({name})` por campo o `getValues` en handlers.

## Ola 3 — Higiene (P17–P20)

17. **P17** — `experimentalMinChunkSize: 10_000` en `vite.config.ts` (sin `manualChunks`).
18. **P18** — `Cxp.tsx`: quitar `useCobranza({})` del cuerpo; usar `queryClient.fetchQuery` en handler del PDF.
19. **P19** — `NODE_OPTIONS=--max-old-space-size=2048` en jobs de build de `ci.yml` y `e2e.yml`.
20. **P20** — Añadir `"use memo"` a archivos tocados en P2/P3/P11 (`Cxp.tsx`, `cxpColumns.tsx`, `EstadoFacturaCxPCell.tsx`, `TesoreriaConciliacion.tsx`, `ResponsiveDataTable.tsx`).

---

## Notas técnicas

- Cada ola = 1 bump de `APP_VERSION` + entrada breve en `CHANGELOG.md` (raíz).
- Verificación por ola: `bun run lint --max-warnings 0`, typecheck, tests unitarios, `audit:tests`, `audit:arch`; tests SQL específicos en P9/P10/P13.
- Verificación final: entry < 300 KB gz, `@react-pdf` fuera del inicial, Sentry fuera del inicial, dashboard ejecutivo < 10 requests, aging/profit aislados por org con fixture de 2 tenants.
- **No hacer:** tocar guards de dinero (excepto P13 con tests), config global de React Query, Embarques/facturación-aging, reintroducir `manualChunks`, añadir librerías nuevas.

## Riesgo & rollback

- P4/P5/P8/P9/P10/P13/P14 son migraciones SQL — se aplican con `CREATE OR REPLACE`/`IF NOT EXISTS` (reversibles con la versión previa preservada en git).
- P17 tiene rollback explícito si aparece error de init.
- P13 es el más delicado (dinero): no mergea sin tests SQL verdes.

## Estimación

Ola 0: 3-4 días · Ola 1: 5-7 días · Ola 2: 5-7 días · Ola 3: ~1 día.

¿Empiezo por Ola 0 (P1–P6) al aprobar? Ejecuta todo lo que se pueda hacer con sub agentes

&nbsp;