# Auditoría de Rendimiento — Libre Carga

Análisis de la aplicación realizado sobre rutas, hooks, servicios, bundle y assets. Recomendaciones ordenadas por **impacto vs esfuerzo**. **No se hicieron cambios de código.**

---

## 1. Assets y carga inicial (alto impacto, bajo esfuerzo)

- **`librecarga-logo.png` (154 KB)** se importa desde 3 lugares (`Login.tsx`, `AppSidebar.tsx`, `PortalLayout.tsx`). Existe ya un `librecarga-logo.svg` (668 B) en `public/`. **Migrar todos los imports al SVG** reduce ~460 KB de descarga inicial y elimina rasterización.
- **`favicon.png` (131 KB)** y **`favicon.ico` (20 KB)**: el PNG es excesivo para un favicon. Reemplazar por uno de 32×32 / 64×64 (~2–5 KB).
- **`changelogData.ts` (792 LOC)** + 7 archivos `changelog/v*.ts` se importan desde rutas que no son `/changelog`. Verificar que el módulo solo se cargue al entrar a `/changelog` (lazy import dentro de la página, no en la barrel global).

## 2. Consultas a base de datos (alto impacto)

- **22 queries usando `.select('*')`** en servicios (`trackingService`, `proforma/queries`, `cotizacion/crud`, `cotizacion/costos`, `cotizacion/conversiones`, `embarque/eventos`, `proforma/facturar`, `configuracionService`, `portal/queries`, `planesService`). Cada una transmite columnas innecesarias. **Reemplazar por listas de columnas explícitas** (ya se hace bien en `embarque/queries.ts` con `EMBARQUE_LIST_COLUMNS`). Aplicar el mismo patrón a los demás servicios.
- **`useCotizaciones()` en `Cotizaciones.tsx` carga TODAS las cotizaciones sin paginación servidor** (a diferencia de Embarques/Clientes/Proveedores que sí tienen `fetchEmbarquesPaginados`). Implementar paginación server-side con `range()` + `count: 'exact'`. Lo mismo revisar para `Facturacion.tsx`.
- **Filtro `.or()` con `ilike` en `fetchEmbarquesPaginados`** sobre 4 columnas sin índices generará scans secuenciales en tablas grandes. Crear índices `GIN` con `pg_trgm` sobre `expediente`, `cliente_nombre`, `bl_master` para acelerar búsquedas.

## 3. React Query — caché y deduplicación

- `staleTime` global = **30 s** es bajo para catálogos casi estáticos. Subir a **5–10 min** específicamente para: `usePuertos`, `useNavieras`, `useTiposContenedor`, `useProveedores` (en selects), `useTasaIVA`, `useConfiguracion`. Reduce refetches al cambiar de página.
- **Múltiples páginas vuelven a llamar `useClientes()` / `useProveedores()` enteros** solo para poblar selects. Considerar un endpoint ligero `fetchClientesMinimos(id, nombre)` para selects, separado del listado completo.
- Activar `placeholderData: keepPreviousData` en queries paginadas (Embarques, Clientes, Proveedores) para que la paginación no muestre skeleton al cambiar de página.

## 4. Re-renders y trabajo en main thread (impacto medio)

- **Cero usos de `React.memo`** en todo `src/`. Tablas grandes (`DataTable`) se re-renderizan completas al cambiar cualquier estado del padre. Memorizar:
  - Filas de `DataTable` (envolver `TableRow` interno con `memo` y comparador estable).
  - Componentes pesados como `OperacionesWidgets`, `DesempenoOperadores`, `ReportesTopChart`, badges (`ProfitBadge`, `EstadoBadge`).
- Confirmar que las `columns: DataTableColumn[]` en cada página están en `useMemo`; si se redefinen en cada render, la tabla pierde memorización.
- **`AppSidebar` se re-renderiza con cada navegación** (usa `useLocation`). Splittearlo: parte estática (logo, nav items) memorizada; solo el indicador de ruta activa reactivo.

## 5. Bundle y vendor splitting (impacto medio)

- **`vite.config.ts` ya divide vendors** (react, query, charts, radix). Bien. Mejoras adicionales:
  - Mover `recharts` (solo usado en 4 archivos) a chunks por-ruta en lugar de vendor global, ya que se incluye aunque el usuario nunca abra Operaciones/Reportes.
  - Verificar tree-shaking de `lucide-react`: cada icono se importa nominal (`import { Ship } from "lucide-react"`) lo cual es correcto; revisar que no haya `import * as Icons`.
  - `date-fns` se usa con imports nominales (correcto). Considerar eliminar `Locale` import duplicado si solo se usa `es`.
- Generar el bundle con `ANALYZE=true npm run build` (ya está configurado el plugin `visualizer`) y revisar `dist/bundle-stats.html` para identificar el chunk más pesado.

## 6. Hooks y orquestación de datos

- **`useDashboardData`**: carga `summary` + `details` en serie (details depende de summary). Es buen patrón para TTI. Verificar que el RPC `dashboard_stats()` esté indexado y no recalcule en cada llamada (cachear en Postgres con materialized views si es lento).
- **`useEmbarquesListExtras`**: query única por página de embarques (bien, evita N+1). Confirmar que el RPC retorna en <200 ms; si no, agregar índice por `embarque_id` en tablas de documentos/conceptos.
- **`useExchangeRates`**: `staleTime` 1 h es razonable. No requiere cambios.
- **`useSidebarAlerts`**: 5 min OK. Si la query es costosa, mover los conteos a un RPC dedicado en vez de varias queries.

## 7. Otros

- **`PortalCotizacionDetalle`, `EmbarqueDetalle`, `CotizacionDetalle`**: cada uno hace múltiples queries en paralelo al montar. Considerar un único RPC `embarque_full(id)` que devuelva embarque + conceptos + documentos + notas en un solo round-trip.
- **`useProfitMaps` y cálculos financieros**: validar que se ejecutan dentro de `useMemo` y no en cada render del padre.
- **Error en consola actual**: `Function components cannot be given refs` en `RouteLoadingFallback` y `Login`. Envolver con `forwardRef` cuando se usan dentro de Suspense con refs implícitas. No es performance, pero contamina logs.

---

## Resumen priorizado

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | Cambiar `.png` del logo por `.svg` (3 archivos) | Alto | Mínimo |
| 2 | Reducir tamaño del favicon | Alto | Mínimo |
| 3 | Paginación server-side en Cotizaciones y Facturación | Alto | Medio |
| 4 | Reemplazar `select('*')` por columnas explícitas (22 queries) | Alto | Medio |
| 5 | Subir `staleTime` a 5–10 min en catálogos estáticos | Medio | Mínimo |
| 6 | `keepPreviousData` en queries paginadas | Medio | Mínimo |
| 7 | `React.memo` en filas de `DataTable` y badges | Medio | Medio |
| 8 | Índices `pg_trgm` para búsquedas `ilike` en embarques | Medio | Bajo |
| 9 | Endpoint ligero para selects de Clientes/Proveedores | Medio | Medio |
| 10 | Ejecutar `ANALYZE=true` y revisar bundle | Diagnóstico | Mínimo |
| 11 | Memorizar `AppSidebar` (parte estática) | Bajo | Bajo |
| 12 | Consolidar queries de detalle en un RPC único | Alto | Alto |

Si apruebas, puedo implementar los puntos 1–8 en una sola iteración (alto impacto, esfuerzo combinado bajo-medio) y dejar los puntos 9–12 para una segunda fase.
