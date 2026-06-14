# Fase 4 + Fase 5 — Filtros móviles y páginas legacy

Continuamos la refinación móvil (20:9 / ≤412px). Solo UI/presentación, sin tocar lógica de negocio.

## Fase 4 — Filtros móviles consistentes

### Objetivo
Replicar el patrón ya probado en Cotizaciones (`CotizacionesMobileFilters.tsx` con Sheet lateral + chip count) en los módulos que aún muestran filas de filtros apretadas en móvil.

### 1. Nuevo componente genérico
Ruta: `src/components/shared/MobileFiltersSheet.tsx`
- Wrapper reutilizable con `Sheet` derecho, header, área scrollable y footer "Limpiar / Aplicar".
- Props: `open`, `onOpenChange`, `activeCount`, `onClearAll`, `title`, `children` (los selects).
- Se renderiza solo en `<md`. El trigger (botón "Filtros" con badge) se expone como sub-componente `<MobileFiltersTrigger>` para que cada página lo coloque junto a su search.

### 2. Módulos a migrar
Cada uno gana un bloque visible `md:hidden` con search + botón "Filtros (n)" y mantiene su barra actual en `≥md`:

- **Embarques** — `src/features/embarques/routes/Embarques.tsx` + `EmbarquesFiltersBar` (si existe). Filtros: modo, estado, cliente, operador, rango fechas.
- **Proveedores** — `src/pages/proveedores/ProveedoresFiltros.tsx` (o donde vivan los selects). Filtros: tipo, país, estatus.
- **CRM Leads** — `src/features/crm/routes/Leads.tsx`. Filtros: etapa, fuente, vendedor.
- **CRM Oportunidades** — `OportunidadesFiltersBar.tsx`: el grid `grid-cols-2 md:grid-cols-6` ya colapsa, pero en móvil ocupa demasiada altura → moverlo al Sheet.
- **CxP** — `src/features/cxp/...` (donde se renderiza `CxpFiltrosChips`). Llevar selects al Sheet, dejar chips activos visibles en móvil debajo del search.
- **Reportes** — `ReportesFiltros.tsx`: los 3 controles (desde/hasta/modo) van al Sheet en móvil.
- **Auditoría Hallazgos** — `HallazgosFiltros.tsx`: el `flex-wrap` apila 6+ controles → mover `HallazgosFiltrosSelects` y `HallazgosFiltrosFechas` al Sheet.

### 3. Refinamientos puntuales
- En todos los Sheets: footer sticky con `safe-area-inset-bottom` (Tailwind `pb-[env(safe-area-inset-bottom)]`).
- Search input siempre visible fuera del Sheet (acceso rápido).
- Badge de conteo reutiliza el patrón de Cotizaciones (variant `secondary`, `h-5 min-w-5`).

---

## Fase 5 — Páginas legacy y PageHeader

### Objetivo
Limpiar páginas que aún tienen padding/typography solo-desktop y normalizar el header global.

### 1. `PageHeader` (`src/components/layout/PageHeader.tsx`)
- En `<sm`: título y badge/acciones se apilan (`flex-col gap-2`) en lugar de competir por el ancho.
- Título `text-2xl sm:text-3xl`, descripción `text-sm` truncada con `line-clamp-2`.
- Acciones del lado derecho: en móvil ocupan el ancho completo (`w-full sm:w-auto`).

### 2. Páginas legacy con padding fijo
Buscar `p-6`/`p-8` en contenedores de página y normalizar a `p-4 sm:p-6`:
- `src/pages/profit/ProfitDashboardEjecutivo.tsx`
- `src/pages/profit/ProfitEstadoResultados.tsx`
- `src/pages/profit/ProfitPresupuesto.tsx`
- `src/pages/profit/ProfitProyeccion.tsx`
- `src/pages/tesoreria/TesoreriaCuentas.tsx`
- `src/pages/tesoreria/TesoreriaFlujo.tsx`
- `src/pages/admin/AdminOrganizaciones.tsx`, `AdminUsuarios.tsx`, `AdminConfiguracion.tsx`, `Papelera.tsx`
- `src/pages/admin-org/Usuarios.tsx`, `Configuracion.tsx`
- `src/pages/comisiones/Comisiones.tsx`
- `src/pages/dashboard/Reportes.tsx`

### 3. Tabs horizontales con overflow
Donde haya `Tabs` con muchas pestañas (Profit, Auditoría, CRM), envolver `TabsList` en `overflow-x-auto` con `scrollbar-thin` para evitar truncamiento en móvil.

### 4. Diálogos y wizards anchos
- Wizards (cotización, cliente, embarque): garantizar `max-w-full sm:max-w-2xl` y `max-h-[90dvh] overflow-y-auto` en `DialogContent`. Solo donde hoy sea fijo.

### 5. Portal cliente
- `src/pages/portal/PortalDashboard.tsx`, `PortalPerfil.tsx`: `p-4 sm:p-6`, KPIs migran a `KpiStrip` (Fase 3 ya creado).

---

## Excluye
- Lógica de negocio, queries, mutaciones.
- Tipografía `clamp()` (Fase 6 futura).
- Refactor de tablas (ya cubierto en Fase 2).

## Metadata
- `src/constants/appVersion.ts` → `13.18.0` al terminar Fase 4, `13.19.0` al terminar Fase 5.
- `CHANGELOG.md` con dos entradas separadas.

## Validación
- `tsc --noEmit` limpio tras cada fase.
- Screenshots móvil 412×915 y desktop 1366×768 en: `/embarques`, `/proveedores`, `/crm/leads`, `/crm/oportunidades`, `/cxp`, `/reportes`, `/auditoria`, `/profit/dashboard-ejecutivo`, `/tesoreria/cuentas`, `/portal/dashboard`.
- Confirmar: search siempre visible, botón "Filtros" abre Sheet con badge correcto, chips activos visibles, sin overflow horizontal en `<sm`, header apilado correctamente.

## Orden de ejecución
1. Fase 4 completa → commit + bump `13.18.0`.
2. Fase 5 completa → commit + bump `13.19.0`.
