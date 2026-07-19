## Veredicto

La auditoría es **correcta y aplicable**. Los 7 hallazgos son reales y todos comparten una sola raíz: montos completos en celdas estrechas (~66–115 px) a 402 px de ancho. La solución propuesta (`MoneyCell` canónico + formato compacto con `title`) es consistente con lo que ya hicimos en Sprint 2 (KpiCard adaptativa, `formatCurrencyCompact`, tokens semánticos). No detecto conflictos con memoria del proyecto.

## Plan de aplicación

### 1. Nuevo componente canónico
- `src/components/shared/MoneyCell.tsx` — celda `min-w-0` + `truncate` + `title` con `fullValue`, tipografía `text-sm sm:text-base`, variante `highlight` para totales. Cierra los bugs 1.1–1.4 de raíz.

### 2. Fixes 🔴 críticos
- **1.1** `dashboard/finance/components/CobranzaBlock.tsx` → montos aging con `formatCurrencyCompact` + `title=formatCurrency`.
- **1.2** `facturacion/components/detalle/FacturaTotalesCard.tsx` → migrar a `MoneyCell`.
- **1.3** `portal/components/factura/PortalFacturaResumenCard.tsx` → migrar a `MoneyCell` (portal = pantalla más usada en móvil).

### 3. Fixes 🟠 y 🟡
- **1.4** `dashboard/finance/components/CierreAdminBlock.tsx` → `Tile` con compacto + `title`.
- **1.5** `compras/routes/_sections/ConciliacionDetalleSections.tsx` (`TotalesMonedaFooter`) → wrap en `overflow-x-auto` + `min-w-[560px]`.
- **1.6** `embarques/components/StepCostosPrecios.tsx` → Utilidad Estimada `text-lg sm:text-xl` + `truncate` + `title`.
- **1.7** `components/ui/dialog.tsx` → `w-[calc(100vw-2rem)]` + `rounded-xl` (quitar `sm:rounded-xl`). Cambio de sistema: aplica a **todos los diálogos**; validar smoke en 3–4 modales representativos (form dialogs, alerts, wizard).

### 4. Pulido 🟢 (opcional, mismo turno)
- Selects de filtro en 4 archivos → `w-full sm:w-[Npx]`:
  - `ReportesFiltros`, `ProveedoresFiltros`, `TesoreriaConciliacion`, `PeriodoMensualToolbar`.

### 5. Verificación
- `bun run ci:fast` (lint + typecheck + tests fast).
- Smoke visual con Playwright a **402×874**: `/portal/facturas/:id`, `/facturacion/:id`, `/inicio` (Cobranza + Cierre), `/compras/conciliacion/:id`, wizard embarque Step Costos.
- Verificar que ningún snapshot rompa por el cambio de `dialog.tsx`.

### 6. Changelog y versión
- `APP_VERSION` → `13.302.6`.
- Entrada `## [13.302.6] - 2026-07-19`:
  - Nuevo `MoneyCell` canónico + adopción en 4 tarjetas de dinero (Cobranza, Cierre admin, Totales factura, Portal factura).
  - Fix overflow: footer conciliación, utilidad estimada Step Costos.
  - `Dialog` con margen de 16 px y radio en todos los tamaños.
  - Selects de filtro full-width en móvil (4 toolbars).

## Riesgos
- **Bajo/medio**: `dialog.tsx` toca todos los modales; el cambio es puramente presentacional pero pide smoke visual.
- **Bajo**: `MoneyCell` no altera datos; el resto son classes/wrappers.
- Sin cambios de lógica de negocio ni de servicios.

## Alcance excluido
- No tocar `LogoPreview` ni stat-cells de diálogos (ya justificados en cierre anterior).
- No refactor masivo de otros footers con `grid-cols-N`; solo los detectados.

¿Aplico?
