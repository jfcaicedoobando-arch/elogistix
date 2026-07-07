# Auditoría de skeletons de la app

**Alcance medido:** 240 usos de `<Skeleton />` distribuidos en 80 archivos. Solo 3 primitivas centrales existen hoy: `Skeleton` (ui), `ListSkeleton` (states), `ChartSkeleton`. El resto son ensambles ad-hoc página por página.

Analogía: hoy cada pantalla "dibuja su propio esqueleto a mano". Queremos una caja de piezas Lego con 4–5 formas listas que cualquier pantalla arme en 1 línea, y que respire (accesibilidad + reduced-motion) sola.

---

## Hallazgos (severidad → impacto)

### 1. CRITICAL — Sin `prefers-reduced-motion`
- **Archivo:** `src/components/ui/skeleton.tsx:4`
- **Qué pasa:** todas las 240 instancias heredan `animate-pulse` sin condicional. Cero ocurrencias de `motion-safe` / `motion-reduce` / `prefers-reduced-motion` en todo el repo.
- **Riesgo:** usuarios con vestíbulo sensible (mareo, migraña, WCAG 2.3.3) reciben pulso continuo en toda la app. Falla accesibilidad.
- **Fix:** cambiar `animate-pulse` → `motion-safe:animate-pulse` en la primitiva. Un solo diff, cero riesgo, corrige las 240 instancias.

### 2. CRITICAL — Skeletons no anuncian carga a lectores de pantalla
- **Archivos:** solo `ListSkeleton` marca `role="status" aria-live="polite" aria-label="Cargando"`. `Skeleton`, `ChartSkeleton`, `RouteLoadingFallback`, `DataTableBody`, `VirtualTableParts.SkeletonRows` y las 200+ instancias ad-hoc no lo hacen.
- **Riesgo:** VoiceOver / NVDA no anuncian "cargando" — el usuario cree que la app se congeló. Bloquea WCAG 4.1.3 (Status Messages).
- **Fix:** agregar `role="status"` + `aria-busy="true"` + `aria-label="Cargando"` en la primitiva y en los wrappers de grupo (`RouteLoadingFallback`, `SkeletonRows`, `DataTableBody[isLoading]`, `ChartSkeleton`). El `Skeleton` individual dentro de un grupo debe ser `aria-hidden`.

### 3. HIGH — Duplicación masiva del mismo patrón "N tarjetas de altura X"
- **Archivos:** repetido literalmente en:
  - `RouteLoadingFallback.tsx:22-25` (4 cards h-24)
  - `Tesoreria.tsx:64` (4 cards h-20)
  - `DireccionDashboard.tsx:36-42` (3 cards h-32 + 2 h-64)
  - `PortalDashboard.tsx:44-49` (3 cards h-20 + 2 h-64)
  - `ArribosCard.tsx`, `KpiCard.tsx`, `KpiTile.tsx` (cada uno con `<Skeleton className="h-X w-Y" />` inline)
  - `HistorialFacturaSection`, `AlertasSistemaPanel`, `NotasCreditoSection`, `EmbarquesPendientesAdminCard`, `TimelineEstadosCard`, `TrackingPublicoLoading`, `EmbarqueDetalleStates.LoadingState`, etc.
- **Riesgo:** cualquier cambio de estilo (altura, radio, animación, contraste) requiere tocar N archivos. Divergencia visual entre páginas ya presente (h-20 vs h-24 vs h-32 sin criterio).
- **Fix:** introducir 4 primitivas nuevas en `src/components/shared/states/`:
  - `KpiGridSkeleton` (columnas + altura por breakpoint)
  - `CardSkeleton` (una card con título + 2 líneas)
  - `DetailSkeleton` (patrón header + grid — reemplaza `RouteLoadingFallback`, `EmbarqueDetalleStates.LoadingState`, `TesoreriaCuentas`, `Tesoreria`, `DireccionDashboard`, `PortalDashboard`)
  - `FieldGridSkeleton` (`FacturaReceptorCard`, `FacturaEmisorCard`, `FacturaBitacoraCard`, `FacturaPagosSection`, `PortalFacturaPagosCard` — todos usan `Skeleton h-16..24 w-full` que da un bloque plano poco informativo)

### 4. HIGH — Skeletons planos que no comunican la forma real
- **Archivos:** `FacturaReceptorCard.tsx:91` (`<Skeleton className="h-24 w-full" />` para lo que después será un grid 3×2 con labels + values), `FacturaPagosSection`, `FacturaBitacoraCard`, `FacturaEmisorCard`, `PortalFacturaPagosCard`, `NotasCreditoSection`, `PanelConciliacionMovimiento`, `AuditoriaEjecutivoTab`.
- **Riesgo:** salto visual grande cuando cargan datos (el bloque plano de 96px se convierte en un grid detallado de ~200px). Contradice el trabajo hecho en `DataTableBody` (donde ya se alineó 1:1 con las filas reales).
- **Fix:** replicar el criterio de `DataTableBody`: cada skeleton debe reflejar la estructura del contenido final (labels arriba, barras alineadas a la derecha para números, alturas fijas por densidad).

### 5. HIGH — `RouteLoadingFallback` es genérico y engaña
- **Archivo:** `src/components/layout/RouteLoadingFallback.tsx`
- **Qué pasa:** dibuja header + 4 KPIs + tabla, pero rutas como `/facturas/:id` (detalle), `/cotizaciones/:id`, `/embarques/:id`, portal, etc. no tienen esa estructura. El usuario ve el "flash" del layout equivocado antes del real.
- **Riesgo:** más CLS percibido que si mostráramos un skeleton neutro. Además rutas de portal cargan este layout con Sidebar/KPIs que no aplican.
- **Fix:** dividir en `PageSkeleton` (neutro: header + `space-y-6` genérico, sin KPIs), y que cada `<Suspense>` de ruta declare el suyo (dashboard usa `DashboardSkeleton`, detalle usa `DetailSkeleton`, tabla usa `TableSkeleton`).

### 6. HIGH — Duplicación de skeleton de tabla entre `DataTable` y `VirtualDataTable`
- **Archivos:** `DataTableBody.tsx:73-121` (skeleton avanzado con ancho variable + align + sticky) vs `VirtualTableParts.tsx:34-49` (skeleton genérico `h-4 w-full` sin variación ni align).
- **Riesgo:** las tablas virtuales (listas grandes) se ven "más pobres" que las normales. Regresión invisible cada vez que se toca una y no la otra.
- **Fix:** extraer `renderTableSkeletonRow(leafColumns, density, rowIndex)` a un módulo compartido (`dataTable/tableSkeletonRow.tsx`) y consumirlo desde ambos.

### 7. MEDIUM — Skeleton en `KpiCard` / `KpiTile` no respeta la tipografía adaptativa
- **Archivos:** `KpiCard.tsx:58` (`h-8 w-24`), `KpiTile.tsx:44` (`h-7 w-20`), `ArribosCard.tsx:115` (`h-6 w-8`).
- **Qué pasa:** el valor real cambia de `text-3xl` → `text-lg` según longitud, pero el skeleton siempre es del mismo tamaño → cuando llegan datos, el card salta de alto.
- **Fix:** el skeleton del valor debe usar la altura mínima que después ocupa `text-3xl leading-tight` (aprox `h-9`). Congelar `min-h` de la card entera durante loading.

### 8. MEDIUM — `ChartSkeleton` solo pinta un rectángulo
- **Archivo:** `src/components/shared/ChartSkeleton.tsx`
- **Qué pasa:** un `Skeleton` liso de altura fija, sin ejes ni barras/líneas. Cuando llega el chart real (con ejes, leyenda, tooltip) el layout salta 30–60px.
- **Fix:** agregar pseudo ejes X/Y con `Skeleton` de baja opacidad + 4–6 barras verticales con alturas variables. Coste ~15 líneas, mantiene la altura y evita CLS.

### 9. MEDIUM — Loop de 3 booleans para decidir loading
- **Archivo:** `PortalDashboard.tsx:38` (`loadingEmb || loadingCot || loadingFac`), y patrones similares en `Tesoreria.tsx`, `Reportes.tsx`, `DireccionDashboard.tsx`.
- **Riesgo:** cascada — mientras UNA query esté cargando, todas las cards ya listas quedan ocultas tras el skeleton monolítico. Peor TTI percibido.
- **Fix:** cada tarjeta acepta su propio `isLoading` y muestra su propio skeleton (progressive reveal). Ya existe la infra (`KpiCard.loading`, `KpiTile.loading`); falta usarla en dashboards de portal / dirección / tesorería.

### 10. MEDIUM — `role="status"` sin `sr-only` texto explícito
- **Archivo:** `ListSkeleton.tsx:26-28`
- **Qué pasa:** el único que anuncia lo hace con `aria-label`, pero un `<span className="sr-only">Cargando lista…</span>` es más robusto entre lectores.
- **Fix:** convención: todo grupo skeleton lleva `<span className="sr-only">{loadingLabel}</span>` como primer hijo.

### 11. LOW — Radios inconsistentes
- **Archivos:** `RouteLoadingFallback` usa `rounded-2xl`/`rounded-xl`/`rounded-lg` mezclado; `DireccionDashboard` usa `rounded-xl`; `Tesoreria` usa el default (`rounded-md` de la primitiva).
- **Fix:** primitiva por tipo (`CardSkeleton` = `rounded-xl`, `ChartSkeleton` = `rounded-lg`, texto = `rounded-md`).

### 12. LOW — `Array.from({ length: 4 }).map(...)` repetido ~25 veces
- **Fix:** helper `<Repeat n={4}>{(i) => ...}</Repeat>` o `range(4).map(...)`. Cosmético pero legible.

---

## Plan de consolidación (3 fases)

### Fase 1 — Base primitiva (impacto máximo, 1 archivo)
Actualizar `src/components/ui/skeleton.tsx`:
- `motion-safe:animate-pulse` (resuelve hallazgo #1 en toda la app)
- `role="status"` + `aria-busy="true"` + `aria-label` opcional cuando no viene de un contenedor
- Prop `variant?: "text" | "block" | "circle" | "chart"` con radios/alturas por defecto

### Fase 2 — Librería `src/components/shared/skeletons/`
Nuevos archivos (~30 líneas cada uno, <200 líneas total):
- `PageSkeleton.tsx` (reemplaza `RouteLoadingFallback` genérico)
- `DetailSkeleton.tsx` (header + 2 columnas grid, para páginas `/*/:id`)
- `DashboardSkeleton.tsx` (KPI grid + 2 charts) — reemplaza `DireccionDashboard`, `PortalDashboard`, `Tesoreria`, `Reportes` loading
- `KpiGridSkeleton.tsx` (props: `count`, `mobileCols`, `heightClass`)
- `CardSkeleton.tsx` (para reemplazar los 60+ `<Skeleton className="h-N w-full" />` dentro de cards)
- `FieldGridSkeleton.tsx` (labels + values grid — reemplaza receptor/emisor/pagos/bitácora de factura)
- `ChartSkeleton.tsx` mejorado (ejes + barras)
- Barrel `index.ts` + tests unitarios de a11y (`toHaveAccessibleName("Cargando")`)

### Fase 3 — Migración incremental
Ir archivo por archivo reemplazando ensambles ad-hoc con las primitivas. Priorizado por tráfico:
1. `RouteLoadingFallback` → `PageSkeleton` (afecta cada navegación lazy)
2. Dashboards: Portal, Dirección, Tesorería, Reportes, Operaciones, Admin, Profit
3. Detalles: Factura, Proforma, Embarque, Cotización, Proveedor, Cliente
4. Tablas virtuales: extraer `tableSkeletonRow` compartido entre `DataTable` y `VirtualDataTable`
5. Cards KPI: unificar `Skeleton` interno en `KpiCard`, `KpiTile`, `ArribosCard`

Cada PR de migración cubre 3–5 archivos, sin cambios de comportamiento, verificable visualmente en preview.

## Detalles técnicos

- Nada de esto cambia lógica de negocio, queries, ni rutas — es 100% presentación.
- Coverage: agregar tests de a11y (`role="status"`, `aria-busy`) a la primitiva y a los 6 wrappers nuevos.
- Bundle: neto ~ +2 KB (6 componentes nuevos) − ~ 4 KB de ensambles ad-hoc reescritos → **reduce bundle**.
- CLS objetivo: 0.02 → <0.01 en las 5 rutas críticas (dashboard, factura, embarque, portal, tesorería) — medible antes/después.
- Bump versión al final de Fase 1 (`13.213.11`), Fase 2 (`13.213.12`), y por lote en Fase 3.
- CHANGELOG en cada fase con analogía Lego para el usuario principiante.

## Fuera de alcance

- Reemplazar Radix Suspense por otro sistema de streaming.
- Cambiar la duración/curva de `animate-pulse` (queda default de Tailwind).
- Introducir shimmer gradiente (más costoso y peor a11y que pulse).
