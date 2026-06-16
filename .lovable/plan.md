## Objetivo
Que las 4 tarjetas KPI del módulo `/cotizaciones` (Total, Aceptadas, Rechazadas, Tasa de conversión) se calculen únicamente sobre cotizaciones creadas en los **últimos 30 días**, independientes de los filtros visibles de la tabla.

## Alcance
- Solo se modifica el cálculo de los KPIs. La tabla, filtros, búsqueda y export CSV siguen funcionando igual sobre el dataset completo.
- Se usa `created_at` como fecha base (criterio uniforme y siempre presente). La ventana es **[hoy − 30 días, ahora]**, calculada con UTC normalizado por `date-time-standards`.

## Cambios

### 1. `src/features/cotizacion/hooks/useCotizacionesPageController.ts`
- Reemplazar el `useMemo` actual de `kpis` (líneas 107–115) para que:
  - Derive un subconjunto `ultimos30 = cotizaciones.filter(c => new Date(c.created_at) >= hace30Dias)`.
  - Sobre ese subconjunto calcule `total`, `aceptadas` (`Aceptada` + `En operación`), `rechazadas` y `tasa`.
- Usar `useMemo` con dependencia `[cotizaciones]` (no `filtered`).
- `hace30Dias` se computa una sola vez fuera del filter con `Date.now() - 30 * 24 * 60 * 60 * 1000`.

### 2. `src/pages/cotizaciones/Cotizaciones.tsx`
- Añadir un subtítulo discreto encima/junto a la grilla de KPIs: **"Últimos 30 días"**, para que el usuario sepa que esos números no responden a sus filtros de tabla.

### 3. Versionado y changelog
- Bump `APP_VERSION` → `13.46.2`.
- Entrada en `CHANGELOG.md`:
  - `feat(cotizaciones/kpis)`: KPIs ahora se calculan solo sobre cotizaciones creadas en los últimos 30 días; tabla y filtros no se ven afectados.

## Fuera de alcance
- No se cambia la fuente de datos (`useCotizaciones` sigue trayendo todo).
- No se agrega un selector de rango personalizado (7/30/90 días) — si lo quieres, lo abordamos en otro paso.
- No se toca el módulo informativo ni el detalle.
