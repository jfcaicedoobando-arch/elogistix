# Migración masiva de skeletons → librería central

**Alcance:** ~65 archivos que todavía importan `Skeleton` de `@/components/ui/skeleton` con ensambles ad-hoc. Meta: reemplazarlos por `PageSkeleton` / `DetailSkeleton` / `DashboardSkeleton` / `KpiGridSkeleton` / `CardSkeleton` / `FieldGridSkeleton` según corresponda, y envolver los residuales en `SkeletonGroup` para heredar `role="status"` + `aria-busy` + `motion-safe`.

Analogía: ya construimos la caja de piezas Lego; ahora reemplazamos los "esqueletos hechos a mano" de cada pantalla por las piezas listas. Al final, todos los estados de carga se ven y se comportan igual.

---

## Reglas de migración (para todos los lotes)

1. **KPI grids** (`Array.from({length:N}).map <Skeleton className="h-X"/>`) → `<KpiGridSkeleton count={N} heightClass="h-X"/>`.
2. **Loading state completo de dashboard** (header + KPIs + charts) → `<DashboardSkeleton kpis={N} />`.
3. **Loading state de detalle** (`/x/:id`) → `<DetailSkeleton />`.
4. **Bloques planos dentro de cards** (`<Skeleton className="h-24 w-full"/>` que después es un grid label+value) → `<FieldGridSkeleton fields={N} cols={2|3} />`.
5. **Listas de N filas** (`{Array.from({length:5}).map <Skeleton className="h-10"/>}`) → `<ListSkeleton rows={5} />` (ya existe).
6. **Charts** → `<ChartSkeleton height={N} />` (ya rediseñado con ejes + barras).
7. **KPI cards individuales** (`KpiCard`, `KpiTile`, `ArribosCard`) — el `<Skeleton>` interno se envuelve en `<SkeletonGroup>` y se ajusta la altura para respetar la tipografía adaptativa (no salta cuando llegan datos).
8. **Residuales legítimos** (un solo `<Skeleton>` inline dentro de una card ya visible) — se dejan pero envueltos en `<SkeletonGroup>` cuando son 2+ hermanos.
9. **VirtualTableParts.SkeletonRows** — se homologa con el skeleton avanzado de `DataTableBody` (mismo ancho variable + align, extraído a helper compartido).
10. **`ui/sidebar.tsx`** — es el sidebar de shadcn, no se toca.

---

## Lotes de migración (~5-8 archivos cada uno, orden por tráfico)

### Lote 1 — Dashboards principales
- `DireccionDashboard.tsx` → `DashboardSkeleton`
- `PortalDashboard.tsx` → `DashboardSkeleton`
- `Tesoreria.tsx` → `KpiGridSkeleton`
- `TesoreriaCuentas.tsx`, `TesoreriaFlujo.tsx`, `TesoreriaConciliacion.tsx` → `KpiGridSkeleton` / `ListSkeleton`
- `Operaciones.tsx` → `DashboardSkeleton`

### Lote 2 — Portal cliente (7 pantallas)
- `PortalFacturas.tsx`, `PortalEmbarques.tsx`, `PortalCotizaciones.tsx` → `PageSkeleton` + `ListSkeleton`
- `PortalFacturaDetalle.tsx`, `PortalCotizacionDetalle.tsx`, `PortalEmbarqueDetalle.tsx` → `DetailSkeleton`
- `PortalFacturaPagosCard.tsx` → `FieldGridSkeleton`

### Lote 3 — Detalles Facturación
- `FacturaDetalle.tsx` → `DetailSkeleton`
- `FacturaReceptorCard.tsx`, `FacturaEmisorCard.tsx` → `FieldGridSkeleton fields={5} cols={3}`
- `FacturaPagosSection.tsx`, `FacturaBitacoraCard.tsx` → `ListSkeleton rows={3}`

### Lote 4 — Cotización & Embarques
- `CotizacionDetalle.tsx`, `EditarCotizacion.tsx`, `EditarEmbarque.tsx` → `DetailSkeleton`
- `SugerenciasTarifaInline.tsx` → `CardSkeleton` × N
- `TabPnl.tsx`, `TabPnlContenedor.tsx` → `KpiGridSkeleton`
- `TrackingPublicoLoading.tsx` → `DetailSkeleton`

### Lote 5 — Compras / CxP / Proveedores
- `HistorialFacturaSection.tsx`, `NotasCreditoSection.tsx`, `DialogDetallePagosProveedor.sections.tsx` → `ListSkeleton`
- `ConciliacionDetalleSections.tsx` → `ListSkeleton`
- `ProveedorDetalle.tsx` → `DetailSkeleton`
- `ProveedorSaludTab.tsx` → `KpiGridSkeleton` + `ChartSkeleton`

### Lote 6 — Dashboard cards + operador
- `ArribosCard.tsx`, `KpiCard.tsx`, `KpiTile.tsx` → wrap con `SkeletonGroup` + alto ajustado a tipografía adaptativa (fix hallazgo #7 de la auditoría)
- `ProximosArribosCard.tsx`, `AlertasDemoraCard.tsx`, `CargasActivasClienteCard.tsx`, `EmbarquesPendientesAdminCard.tsx`, `TimelineEstadosCard.tsx` → `ListSkeleton` o `CardSkeleton`
- `MiOperacionWidgets.tsx`, `DesempenoOperadores.tsx` → `KpiGridSkeleton` + `ListSkeleton`
- `Bitacora.tsx` → `ListSkeleton`

### Lote 7 — Finance + Profit + Presupuesto
- `PagosCajaBlock.tsx`, `CobranzaBlock.tsx`, `CierreAdminBlock.tsx` → `KpiGridSkeleton` + `ListSkeleton`
- `ProfitDashboardEjecutivo.tsx`, `ProfitEstadoResultados.tsx` → `DashboardSkeleton` / `ListSkeleton`
- `TabCaptura.tsx`, `TabCategorias.tsx`, `TabVsReal.tsx` → `ListSkeleton` / `KpiGridSkeleton`

### Lote 8 — Admin + Auditoría + Reportes + tablas virtuales
- `AlertasSistemaPanel.tsx` → `ListSkeleton`
- `HealthTopErrorsChart.tsx`, `HealthTimelineChart.tsx` → `ChartSkeleton`
- `HealthSlowestTable.tsx` → `ListSkeleton`
- `AuditoriaTendenciaChart.tsx` → `ChartSkeleton`
- `ReportesTopChart.tsx` → `ChartSkeleton`
- `VirtualTableParts.SkeletonRows` + `ResponsiveDataTable` → extraer helper `tableSkeletonRow` compartido con `DataTableBody`
- `PanelConciliacionMovimiento.tsx` → `CardSkeleton`

---

## Estrategia de ejecución

- Ejecuto los **8 lotes de corrido en un solo turno** (ediciones en paralelo por lote). Cada archivo es un cambio de 3-15 líneas — reemplazo `Skeleton` planos y ajusto el import.
- Después de cada lote grande corro `tsgo` para validar tipos y `bunx vitest run` sobre los 12 tests de skeleton para regresión.
- Al final: bump `APP_VERSION` a `13.213.12`, entrada `CHANGELOG.md`.

## Verificación

- `rg "from \"@/components/ui/skeleton\"" src --type ts -g '!*.test.*'` — debería caer de 66 → ~5 (solo primitiva, sidebar shadcn y KpiCard/KpiTile/ArribosCard donde el `Skeleton` inline sí tiene sentido).
- Tests: 12/12 + los del changelog previo.
- Preview visual manual en las rutas: `/`, `/dashboard`, `/facturas/:id`, `/embarques/:id`, `/portal/dashboard`, `/tesoreria`.

## Fuera de alcance

- No cambio lógica de queries ni de negocio — 100% presentación.
- No toco `ui/sidebar.tsx` (shadcn stock).
- No introduzco shimmer gradiente (peor a11y que pulse).
- No re-migro `ListSkeleton` (ya cumple la convención).

## Riesgos y mitigación

- **Alturas distintas al reemplazar**: cada `DashboardSkeleton`/`KpiGridSkeleton` respeta la altura previa vía `heightClass` prop → cero regresión visual.
- **Props del componente destino**: si algún caller pasaba clases custom (`rounded-2xl`, `bg-warning/40`), se preservan vía `className` en el wrapper.
- **Rollback**: los cambios son mecánicos por archivo — si un lote genera problema, se revierte solo ese lote.
