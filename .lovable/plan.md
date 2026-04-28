# Plan de optimización de performance (v8.99.43 → v8.99.46)

Aplicar las 5 recomendaciones del análisis previo en 4 oleadas, de menor a mayor riesgo. Cada oleada es desplegable y reversible por separado.

## Oleada A — Quick wins de base de datos y caché (v8.99.43)

**Backend (sin migraciones):**
- En `src/services/embarque/queries.ts` (`fetchEmbarquesPaginados`), `src/services/cliente/crud.ts` (`fetchClientesPaginados`) y `src/services/proveedorServices.ts` (`fetchProveedoresPaginados`): cambiar `count: 'exact'` → `count: 'estimated'`. Evita full-scans en cada cambio de filtro/búsqueda.
- Confirmado: `BreadcrumbContext.value` ya está memoizado, y catálogos (puertos, navieras, tipos contenedor) ya tienen `staleTime: 30 min`. No se tocan.

**Riesgo:** mínimo. El conteo paginado pasa de exacto a aproximado; en tablas <1000 filas la diferencia es 0; en tablas grandes evita 200-800ms por filtro.

## Oleada B — Bundle + carga inicial (v8.99.44)

**Frontend:**
- `index.html`: agregar `<link rel="preconnect" href="https://eorqadkulqtneqjbsblk.supabase.co" crossorigin>` y `<link rel="dns-prefetch" href="https://eorqadkulqtneqjbsblk.supabase.co">` para ahorrar la negociación TLS del primer request (~150-300 ms).
- `vite.config.ts`: ampliar `manualChunks.radix-vendor` con `@radix-ui/react-avatar`, `react-tooltip`, `react-scroll-area`, `react-toast`, `react-separator`, `react-checkbox`, `react-switch` (los que se usan en >3 páginas) para evitar duplicación entre chunks de ruta.
- Lazy-import de Recharts en `OperacionesWidgets.tsx` y `ProfitTable.tsx`: extraer el bloque `<BarChart>` a un componente envuelto en `React.lazy(() => import("./ChartXxx"))` con `<Suspense fallback={skeleton}>`. Recharts (~400KB) deja de cargarse en el primer paint del Dashboard.

**Riesgo:** bajo. Solo cambios de bundling; la UI se ve igual.

## Oleada C — Consolidación de queries del detalle de embarque (v8.99.45)

**Migración SQL:** crear RPC `public.get_embarque_full(p_embarque_id uuid) returns jsonb` que devuelve en una sola llamada:
```jsonb
{
  "embarque": { ... EMBARQUE_DETAIL_COLUMNS ... },
  "conceptosVenta": [ ... ],
  "conceptosCosto": [ ... ],
  "documentos": [ ... ],
  "notas": [ ... ],
  "facturas": [ ... ]
}
```
- `SECURITY INVOKER` para respetar RLS por organización/cliente.
- Devuelve `null` si el usuario no tiene acceso (RLS lo filtra silenciosamente).

**Frontend:**
- Nuevo hook `useEmbarqueFull(id)` en `src/hooks/embarque/useEmbarqueFullQuery.ts` que llama al RPC y expone el mismo shape que los 6 hooks individuales actuales.
- Refactor de `EmbarqueDetalle.tsx` y `PortalEmbarqueDetalle.tsx` para consumir un solo hook en vez de 6.
- Mantener los hooks individuales (`useEmbarqueConceptosVenta`, etc.) para los lugares donde se invalidan tras una mutación (no romper compat).

**Riesgo:** medio. Reduce 6 round-trips a 1 (~500-1500 ms en redes lentas). Validar con `EXPLAIN ANALYZE` que el RPC no se vuelva más lento que las queries individuales.

## Oleada D — Render: paralelizar dashboard + memoizar sidebar (v8.99.46)

**Frontend:**
- `useDashboardData`: quitar el `enabled: !!summary` de la query `details` para que ambas RPCs corran en paralelo desde el primer render. El TTI del dashboard baja ~40%.
- `AppSidebar.tsx`: extraer `SidebarFooter` (avatar + dropdown + theme toggle) a un componente memoizado con `React.memo`. Memoizar el array de `navItems` con `useMemo` (no se recalcula en cada cambio de ruta).
- `DataTable`: envolver `TableRow` en `React.memo` con comparador shallow para evitar re-render de filas no afectadas cuando cambia el estado del padre.
- Verificar y agregar `placeholderData` desde la lista cacheada en `useEmbarque(id)` y `useCliente(id)` para render instantáneo al navegar lista → detalle.

**Riesgo:** medio-bajo. Cambios de patrón de render; cubiertos por tests existentes de `DataTable`.

---

## Detalles técnicos

**Cambios por archivo (resumen):**
```text
Oleada A (3 archivos):
  src/services/embarque/queries.ts          count → estimated
  src/services/cliente/crud.ts              count → estimated
  src/services/proveedorServices.ts         count → estimated

Oleada B (3 archivos):
  index.html                                preconnect/dns-prefetch
  vite.config.ts                            ampliar radix-vendor chunk
  src/components/operaciones/OperacionesWidgets.tsx   extraer chart → lazy
  src/components/dashboard/ProfitTable.tsx            (si usa recharts)

Oleada C (1 migración + 3 archivos):
  Migración SQL                             create function get_embarque_full
  src/hooks/embarque/useEmbarqueFullQuery.ts  nuevo hook
  src/pages/embarques/EmbarqueDetalle.tsx     consumir hook unificado
  src/pages/portal/PortalEmbarqueDetalle.tsx  idem

Oleada D (3 archivos):
  src/hooks/dashboard/useDashboardData.ts   quitar enabled, paralelizar
  src/components/layout/AppSidebar.tsx      memo footer + items
  src/components/shared/DataTable.tsx       React.memo en filas
  src/hooks/cliente/useClientes.ts          placeholderData desde lista
  src/hooks/embarque/useEmbarqueQueries.ts  placeholderData desde lista
```

**Changelog:** una entrada por oleada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` (v8.99.43, .44, .45, .46) describiendo el cambio en términos de impacto al usuario ("Listas paginadas hasta 60% más rápidas", "Carga inicial reduce ~300ms", etc.).

**Memoria:** sin cambios. Todas las decisiones aplican estándares ya documentados (memoization, server pagination, query optimization).

**Métricas esperadas (orden de magnitud):**
- Oleada A: -200 a -800 ms por cambio de filtro en listas grandes.
- Oleada B: -300 ms en TTFP (Time to First Paint), -400 KB en bundle inicial del Dashboard.
- Oleada C: 1 request en lugar de 6 en detalle de embarque (-1.0 a -1.5 s en red móvil).
- Oleada D: -40% en TTI del Dashboard, render instantáneo lista→detalle.

¿Apruebas para ejecutar las 4 oleadas en secuencia?
