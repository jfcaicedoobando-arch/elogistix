## Ola 1 — Performance PR 2 (P7–P10)

Base: `v13.317.1` (Ola 0 cerrada, lint verde). Un solo PR con los 4 ítems, respetando las reglas globales de la auditoría (no tocar guards de dinero, formatters solo en `src/lib/formatters`, queryKeys centralizadas, migraciones idempotentes, tests obligatorios).

---

### P7 · Bandeja Facturación con paginación server-side (1–2 días)

Estado actual verificado: la bandeja usa `useFacturacionPageController` → `useFacturas()` → `fetchFacturas(orgId)` → llama internamente `fetchFacturasListado({ page:0, pageSize:5000 })` y pagina en el browser. `fetchFacturasListado` ya devuelve `{ data, count }` real.

Cambios:
- `src/features/facturacion/hooks/useFacturas.ts`: nuevo hook `useFacturasListado({ page, pageSize, filtros })` que llame `fetchFacturasListado` con los filtros ya activos (estado, cliente, fecha, search) y `staleTime: 15_000`. Mantener `useFacturas()` para consumidores no-bandeja.
- `src/features/facturacion/queryKeys.ts`: añadir `facturas.listado({ orgId, page, pageSize, filtros })`.
- `src/features/facturacion/hooks/useFacturacionPageController.ts`: agregar estado `page/pageSize` (default 0/100), consumir `useFacturasListado`, exponer `pageCount = Math.ceil(count/pageSize)` y `onPageChange`. Cualquier cambio de filtro/búsqueda hace `setPage(0)` (patrón Embarques).
- `src/features/facturacion/routes/*Bandeja*.tsx`: pasar `pageCount`, `pageIndex`, `onPaginationChange` al DataTable (server-side pagination).
- Test: reescribir `facturasCrud.test.ts:56` (`"fetchFacturas pasa pageSize=5000"`) para probar que el controller pide `page`/`pageSize` reales; añadir test en `useFacturacionPageController.test.tsx` que verifica reset a página 0 al cambiar filtros.

Aceptación: red muestra ≤100 filas por página, paginar dispara un query nuevo, total de páginas cuadra con `count`.

---

### P8 · Dashboard Ejecutivo: 1 RPC de EERR anual (2–3 días)

Estado actual verificado: `agregador.ts:59-75` ejecuta `fetchEerr` 14 veces (mes actual + previo + 12 meses de tendencia). Fuente = `facturas` → `fetchEstadoResultadosDevengado`; fuente = `devengado` → `fetchEstadoResultadosMes`.

Migración `supabase--migration`:
```sql
create or replace function public.eerr_resumen_anual(
  p_year int,
  p_fuente text default 'facturas'  -- 'facturas' | 'devengado'
) returns table(mes int, ingresos numeric, costos numeric, gastos numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with meses as (select generate_series(1,12) as mes),
       datos as (
         -- Reusar los filtros exactos de fetchEstadoResultadosMes / fetchEstadoResultadosDevengado
         -- Filtrado por current_user_org_id() (RLS)
         ...
       )
  select m.mes, coalesce(d.ingresos,0), coalesce(d.costos,0), coalesce(d.gastos,0)
  from meses m left join datos d on d.mes = m.mes;
$$;
grant execute on function public.eerr_resumen_anual(int, text) to authenticated;
```
(Los filtros exactos se replican con `CREATE OR REPLACE` — se leen `estadoResultados.ts` y `estadoResultadosDevengado.ts` y se traducen a SQL con `date_trunc('month', ...)` y `generate_series(1,12)`.)

Frontend:
- `src/features/dashboardEjecutivo/services/agregador.ts`: reemplazar las 14 llamadas por **1** `supabase.rpc("eerr_resumen_anual", { p_year, p_fuente })` + mapper puro `mapRpcToEerrMensual(rows, year)` que devuelve las estructuras que hoy consumen `mesActual`, `mesPrevio` y `tendencia12m`.
- Ya paralelizado tesorería/flujo en P4; verificar que sigue en `Promise.all`.

Test: vitest del mapper (fixture RPC → estructuras esperadas). Test SQL opcional `tests/sql/eerr_resumen_anual.sql` con fixture de 2 meses.

Aceptación: mismos números que antes en el dashboard; Network <10 requests.

---

### P9 · Aging CxC/CxP acotado a la org (1–2 días)

Migración `CREATE OR REPLACE function` de `cxc_aging_clientes` y `cxp_aging_proveedores` (SECURITY DEFINER). En los CTEs `pagado`, `nc` (y equivalentes CxP), agregar JOIN a `facturas`/`proveedor_facturas` y filtrar por `v_org = current_user_org_id()`. Mantener grants existentes y todo el resto igual.

Test SQL obligatorio (patrón `tests/sql/aging_nc_deleted_at.sql`): `tests/sql/aging_org_scope.sql` con fixture de 2 orgs → aging de A no incluye montos de B.

Aceptación: números idénticos para la org actual; suites RLS verdes.

---

### P10 · `profit_por_embarque()` acotado por org (1–2 días)

Migración `CREATE OR REPLACE`: en los CTEs `ventas` y `costos`, JOIN a `embarques e` y filtrar `e.organization_id = current_user_org_id()`. Preservar la homologación a MXN de `20260518213041` intacta.

Test SQL: `tests/sql/profit_org_scope.sql` con fixture 2 orgs.

Aceptación: dashboards de profit idénticos por org; sin fuga cruzada.

---

### Orden de ejecución y checkpoints

1. **P9 + P10** primero (solo migraciones, aisladas, sin cambios de código): un solo `supabase--migration` con las 3 funciones y sus tests SQL.
2. **P8**: migración de `eerr_resumen_anual` + refactor de `agregador.ts` + mapper con tests.
3. **P7**: refactor de hook/controller/bandeja + tests.
4. Bump `APP_VERSION` a `13.318.0`, entrada en `CHANGELOG.md`.
5. Verificación final: `bun run lint --max-warnings 0`, `tsgo`, `bunx vitest run` (subsets tocados), `audit:tests` y `audit:arch`.

### Notas técnicas

- Los RPCs quedan `SECURITY INVOKER` cuando pueden (P8) para respetar RLS; `SECURITY DEFINER` se mantiene donde ya lo era (P9/P10) porque su seguridad depende del filtro explícito por org que estamos añadiendo — ese filtro es precisamente el fix.
- `current_user_org_id()` ya existe en la BD (usado por otros aging fixes previos).
- Sin librerías nuevas.
- El mapper de P8 vive en `src/features/dashboardEjecutivo/services/mappers/eerrAnual.ts` (nuevo, puro, testeable).
