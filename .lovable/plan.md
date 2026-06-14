# Fase 3 — Dashboard responsive (scroll-snap + densidad móvil)

## Objetivo
Hacer que los dashboards (operativo, ejecutivo y CRM) sean cómodos en 20:9 (≤412px): KPIs en carrusel horizontal con scroll-snap en móvil y grid en desktop, cards con jerarquía clara y sin overflow, y secciones con padding consistente.

## Alcance (solo UI / presentación)

### 1. Nuevo componente `KpiStrip`
Ruta: `src/components/shared/KpiStrip.tsx`
- Wrapper genérico que recibe `children` (cards KPI) y aplica:
  - `<sm`: `flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 pb-2 [&>*]:snap-start [&>*]:shrink-0 [&>*]:w-[78%]`
  - `≥sm`: `grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3`
- Prop opcional `desktopCols` para sobreescribir el grid de desktop (default 6).
- Indicador visual: barra de scroll fina con `scrollbar-thin` (utilidad ya existente o inline). Sin lógica nueva.

### 2. Migrar bandas de KPIs a `KpiStrip`
Solo cambia el contenedor (no las cards):
- `src/components/dashboard-ejecutivo/BandaKPIs.tsx` (6 KPIs) → `desktopCols={6}`
- `src/features/dashboard/components/DashboardStatusCards.tsx` (status cards del dashboard operativo) → `desktopCols={5}` o el que ya use
- `src/features/crm/routes/CrmDashboard.tsx` → la "StatStrip" inferior (Leads/Oportunidades/Actividades/Pipeline) pasa de `flex border` a `KpiStrip` con `desktopCols={4}` para que en móvil sea carrusel en lugar de 4 columnas apretadas.

### 3. Dashboard operativo — densidad móvil
`src/pages/dashboard/Dashboard.tsx`:
- `space-y-6` → `space-y-4 sm:space-y-6`.
- Grid de `AlertasDemoraCard` + `ProximosArribosCard`: ya es `grid-cols-1 lg:grid-cols-2`; añadir `gap-4 sm:gap-6` (ya lo tiene, validar).
- `PageHeader`: el badge "X embarques activos" en `<sm` debe quedar debajo del título — verificar que `PageHeader` ya lo haga; si no, no se toca aquí (queda para Fase 5).
- `TimelineEstadosCard` ya fue ajustado en Fase 1.

### 4. Dashboard ejecutivo
`src/pages/profit/ProfitDashboardEjecutivo.tsx` (y `AuditoriaEjecutivoTab.tsx` si aplica patrón similar):
- Verificar contenedor: añadir `px-4 sm:px-6` y `space-y-4 sm:space-y-6` si no lo tiene.
- Grids `md:grid-cols-3` que en móvil quedan apilados — ok, no se cambian. Solo se aplica `KpiStrip` en BandaKPIs.

### 5. CRM Dashboard
`src/features/crm/routes/CrmDashboard.tsx`:
- `p-6` → `p-4 sm:p-6`.
- `grid grid-cols-1 lg:grid-cols-2 gap-4` queda igual.
- StatStrip inferior pasa a `KpiStrip` (ver punto 2).

### 6. Cards internas — overflow seguro
Revisar y añadir `truncate`/`min-w-0` donde haya texto largo que rompa el layout en móvil:
- `KpiCard` (operaciones + dashboard-ejecutivo): verificar que `value` use `truncate` y `tabular-nums`.
- `NextBestActionsCard`, `ActividadesHoyCard`, `CerrandoSemanaCard`, `LeadsSinContactarCard`, `CotizacionesSinRespuestaCard`: si tienen líneas con `flex`, añadir `min-w-0` al contenedor y `truncate` al texto largo. Solo donde se detecte overflow — cambios mínimos.

## No incluye
- Refactor de filtros (Fase 4).
- Páginas legacy sin responsive (Fase 5).
- Tipografía `clamp()` (Fase 6).
- Cambios de lógica de negocio o de queries.

## Archivos a tocar
- Nuevo: `src/components/shared/KpiStrip.tsx`.
- Editar: `BandaKPIs.tsx`, `DashboardStatusCards.tsx`, `CrmDashboard.tsx`, `Dashboard.tsx`, `ProfitDashboardEjecutivo.tsx`, posibles ajustes puntuales en cards CRM.
- Metadata: `CHANGELOG.md` (entrada `[13.17.0]`) y `src/constants/appVersion.ts`.

## Validación
- `tsc --noEmit` limpio.
- `bunx vitest run` sobre archivos modificados (si tienen test).
- Screenshots móvil 412×915 en `/`, `/profit/dashboard-ejecutivo`, `/crm`: KPIs deslizan horizontalmente con snap, sin overflow vertical raro, sin texto cortado.
- Screenshot desktop 1366×768 en las mismas rutas: grid sigue idéntico al actual.
