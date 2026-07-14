# Auditoría UI/UX @ 1920×1080 — Plan de cohesión visual

## Resumen ejecutivo

La app **sí tiene un sistema de diseño robusto** (tokens HSL en `index.css`, `PageContainer`, `KpiCard`, `StatusBadge`, `FormDialogShell`, `dialogSize`, `columnBuilders`, guardrails de arquitectura). El problema es **adopción parcial**: hay ~8 puntos concretos donde módulos reimplementan a mano lo que el sistema ya ofrece. Con 6 lotes de fixes quirúrgicos se elimina la sensación de "parches" sin tocar features.

**Metodología**: 4 sub-agentes en paralelo — Playwright a 1920×1080 (sidebar abierto/cerrado en 10 rutas) + análisis estático de espaciado, tipografía/color y componentes.

**Screenshots guardados**: `/tmp/browser/audit/_{ruta}__{open|closed}.png` (10 rutas × 2 estados).

---

## Hallazgos por severidad

### 🔴 CRITICAL — rompen la cohesión a simple vista

**C1. Cuatro implementaciones paralelas de KPI Card** (Auditoría, CxP, Embarques P&L, Embarques Garantías)
- `AuditoriaKpis.tsx:53` usa `text-2xl font-bold` + labels `uppercase tracking-wide`; el resto del sistema usa `font-semibold` sin uppercase. Los KPIs de auditoría se ven visualmente "más pesados" que los del dashboard.
- `CxpKpiCards.tsx:8-33`: `KPICard` local con `p-3` + `text-lg font-semibold`.
- `embarques/pnl/KpiCard.tsx` y `operaciones/KpiCard.tsx`: nombres duplicados del canónico `@/components/shared/KpiCard`.
- `garantias/GarantiasKpiCards.tsx`: `Card` ad-hoc con `border-l-4`.
- **Fix**: migrar los 4 a `@/components/shared/KpiCard` con `variant` apropiado (`warning`/`success`/`info`/`destructive`). Deprecar los duplicados con re-export.

**C2. Tamaño de `CardTitle` mezclado para el mismo rol jerárquico** (25+ archivos)
- Facturación: `text-lg` · Dashboard: `text-base` · Auditoría: `text-sm` · Embarques: mezcla `text-sm`/`text-base`.
- **Fix**: quitar los overrides y confiar en el default de `ui/card.tsx CardTitle` (`text-2xl` en shadcn) o fijar `text-base font-semibold` como estándar y limpiar overrides.

**C3. Título de página `<h1>` con dos implementaciones distintas**
- `PageHeader.tsx:49` usa `text-display` (token fluido).
- `DetailHeader.tsx:63` y `WizardShell.tsx:120` usan `text-2xl font-bold` hardcoded.
- **Fix**: migrar `DetailHeader` y `WizardShell` a `text-display font-bold`.

**C4. ~15 tablas HTML nativas fuera de la allowlist**
- `CrmDashboard.tsx:97`, `Analitica.tsx:33,55,98`, `TablaFlujoSemanal.tsx:26`, `TesoreriaConciliacion.tsx`, `TabCaptura/TabCategorias/TabVsReal.tsx` (presupuesto), `EstadoResultadosTable.tsx:130`, `SaldosBancosCard.tsx:22`, `FacturaPagosSection.tsx`, `TabLiquidaciones.tsx`.
- Rompen tipografía, sticky header y borders del resto de las tablas.
- **Fix**: migrar a `<Table>` de `@/components/ui/table` (mínimo) o a `DataTable` (ideal). Extender guardrail `no-raw-table.test.ts` con regex `/<table[\s>]/`.

### 🟠 HIGH — visibles en varios módulos

**H1. Escalera de aging con 4 rojos hardcodeados** (`CobranzaBlock.tsx:28-31,108`)
- `bg-red-100/200/300 text-red-800/900/950` — no usa tokens.
- **Fix**: 4 variantes semánticas en `index.css` (`--aging-1..4`) o usar `kpi-warning/danger` con opacidad.

**H2. `lib/ui/estadoConfig.ts:108-149` — mapa central usa colores literales**
- `bg-orange-500/15`, `bg-indigo-500/15` en vez de `state-*`/`kpi-*` tokens.
- **Fix**: migrar a tokens; corrige en cascada varios consumidores.

**H3. `text-green-600` / `text-red-600` puntuales** (7 archivos)
- `BulkImportDialogParts.tsx:52`, `BulkImportSteps.tsx:59,67`, `ActividadRowActions.tsx:59`, `EnvioProformaExitoso.tsx:18`, `PortalProforma.tsx:31`, `AccionesProforma.tsx:90`, `PagosCajaBlock.tsx:172`.
- **Fix**: reemplazar por `text-success` / `text-destructive` (ya existen).

**H4. Modal fuera del sistema `FormDialogShell`**
- `marketing/components/DemoAccessDialog.tsx` usa `DialogContent` crudo con formulario.
- **Fix**: migrar a `FormDialogShell` + `FormDialogSection`.

**H5. Grids KPI con `gap` inconsistente para mismo rol visual**
- `CxpPorCapturar.tsx:105` usa `gap-2`; `Cartera.tsx:57` y `CxpPorPagar.tsx:82` usan `gap-4` (mismo módulo, mismo layout).
- `TabPnl.tsx:69` / `TablaPnlPorMoneda.tsx:98` usan `gap-3` para grid de 4 KPIs; el resto de embarques usa `gap-4`.
- **Fix**: fijar `gap-4` para grids KPI de 3–4 columnas.

### 🟡 MEDIUM — micro-inconsistencias visibles al comparar módulos

**M1. Padding de `CardContent` disperso** (`p-3`/`p-4`/`p-5`/`p-6`)
- Fijar `p-4` como estándar para KPI/resumen; extender la prop `density="tight"|"compact"` (ya usada en `Tesoreria.tsx:19,77`) para variantes densas.
- Casos concretos a corregir: `AuditoriaKpis.tsx:45` (`p-5`), `CxpPorCapturar.tsx:28` (`p-3`), `DashboardEjecutivoFacturacion.tsx:82,110` (`p-3`).

**M2. Contenedores de página raíz que evitan `PageContainer`**
- `NuevaCotizacion.tsx:90` (`max-w-6xl mx-auto px-4 pt-4`), `NuevaCotizacionInformativa.tsx:6` (`space-y-6` sin padding), `Ayuda.tsx:45` (doble wrap).
- **Fix**: envolver en `PageContainer`; para wizard, crear `WizardContainer` documentado como excepción.

**M3. `space-y-3` en `Cotizaciones.tsx:52` mientras el resto de listados usa `space-y-6`**
- **Fix**: `space-y-6`.

**M4. Anchos de `Dialog` crudos en 3 sitios**
- `AgingDrillDownDialog.tsx:128` (`max-w-3xl`), `CotizacionSuccessDialog.tsx:37` y `DemoAccessDialog.tsx:94` (`sm:max-w-md`).
- **Fix**: usar `dialogSize.{md,3xl}` de `dialogTokens.ts`.

**M5. Duplicación de colores de "modo de transporte"** (`uiMappings.ts:36-39` + `ModoIcon.tsx:24-31`).
- **Fix**: consolidar en `uiMappings.ts` con `kpi-info`/`kpi-accent`.

**M6. `AmbienteBadge.tsx:26` + banners de revalidación** (`ReaprobacionTarifaBanner.tsx:67-68`, `RevalidarTarifaModal.tsx:42`) usan literales de color.
- **Fix**: `bg-warning/10 text-warning border-warning/30`.

### 🟢 LOW — pulido

**L1.** Opacidad `/70` sobre `text-muted-foreground` en 4 sitios (doble atenuación, riesgo WCAG en text-xs). Evaluar `--muted-foreground-subtle` o quitar el `/70`.
**L2.** `<button>` nativo de chip en `CxpFiltrosChips.tsx:115` y `TarifasFilterChips.tsx:48` → `<Button variant="ghost" size="sm" className="rounded-full">` para heredar focus-ring.
**L3.** Comentario desactualizado en `PageHeader.tsx:25` (dice `text-2xl`, real es `text-display`).
**L4.** `space-y-4 sm:space-y-6` responsive en `Ayuda.tsx:45` (único caso, romperlo o adoptarlo en todos lados — recomendación: quitar la variante responsive).

### ℹ️ Sidebar (abierto vs cerrado)
No se detectaron bugs de re-flow: `SidebarProvider` + `Sidebar collapsible="icon"` maneja bien el resize (contenido usa `flex-1`). Confirmado en las 20 capturas.

---

## Plan de ejecución (6 lotes)

Cada lote es autónomo y termina en un commit con `APP_VERSION` bumpeado + entrada en `CHANGELOG.md`.

**Lote 1 — Unificación de KPI Cards** (C1)
- Migrar `AuditoriaKpis`, `CxpKpiCards`, `GarantiasKpiCards`, `embarques/pnl/KpiCard` a `@/components/shared/KpiCard`.
- Deprecar `operaciones/KpiCard` con re-export.
- Reemplaza `font-bold`→`font-semibold`, uniforma tamaños y padding.

**Lote 2 — Tipografía canónica** (C2, C3, L3, L4)
- Quitar overrides de `text-lg`/`text-base`/`text-sm` en `CardTitle` (25+ archivos).
- Migrar `DetailHeader` y `WizardShell` a `text-display`.
- Limpiar comentario en `PageHeader.tsx:25`.

**Lote 3 — Tokens de color** (H1, H2, H3, M5, M6)
- Reemplazar 7 sitios de `text-green-600`/`text-red-600` por `text-success`/`text-destructive`.
- Migrar `estadoConfig.ts` a tokens `state-*`/`kpi-*`.
- Refactor de aging en `CobranzaBlock` (nuevos tokens `--aging-*` o variantes de `kpi-warning/danger`).
- Consolidar colores de modo en `uiMappings.ts`.
- Migrar `AmbienteBadge` y banners de revalidación a `warning`.

**Lote 4 — Tablas nativas → shadcn** (C4)
- Migrar 10 archivos con `<table>` HTML a `<Table>` de `@/components/ui/table`.
- Extender `no-raw-table.test.ts` con regex `/<table[\s>]/`.

**Lote 5 — Espaciado y contenedores** (H5, M1, M2, M3, M4)
- Grids KPI a `gap-4` uniforme (3 archivos).
- `CardContent` de KPI a `p-4` (3 archivos) o `density="tight"` donde aplique.
- Wrap `NuevaCotizacion*` y `Ayuda` en `PageContainer`.
- `Cotizaciones.tsx:52`: `space-y-3` → `space-y-6`.
- 3 anchos de Dialog crudos → `dialogSize.*`.

**Lote 6 — Modales y polish** (H4, L1, L2)
- `DemoAccessDialog` → `FormDialogShell`.
- Auditar opacidades `/70` sobre `text-muted-foreground`.
- Chips de filtro con `<Button variant="ghost">`.

---

## Sección técnica

**Archivos clave a tocar** (referencia rápida):
```text
src/components/shared/KpiCard.tsx                 (canónico, no cambia)
src/components/shared/PageHeader.tsx              (limpiar comentario)
src/components/shared/DetailHeader.tsx            (h1 a text-display)
src/features/cotizacion/components/wizard/WizardShell.tsx
src/features/auditoria/components/AuditoriaKpis.tsx
src/features/cxp/components/CxpKpiCards.tsx
src/features/embarques/components/garantias/GarantiasKpiCards.tsx
src/features/embarques/components/pnl/KpiCard.tsx
src/features/operaciones/components/KpiCard.tsx
src/features/dashboard/finance/components/CobranzaBlock.tsx
src/features/dashboard/finance/components/FinanceHeader.tsx
src/features/facturacion/components/AmbienteBadge.tsx
src/features/cotizacion/components/revalidacion/*.tsx
src/lib/ui/estadoConfig.ts
src/lib/ui/uiMappings.ts + src/components/shared/ModoIcon.tsx
src/features/marketing/components/DemoAccessDialog.tsx
src/features/{crm,tesoreria,presupuesto,profit,dashboardEjecutivo,facturacion,comisiones}/*.tsx
   (10 archivos con <table> HTML)
src/__tests__/architecture/no-raw-table.test.ts   (extender regex)
```

**Contrato de tokens** (para nuevas features):
- Título de página → `text-display font-bold`
- Título de card de sección → `text-base font-semibold` (default de `CardTitle`)
- Número KPI → `KpiCard` compartido (`font-semibold` adaptativo)
- Meta/label secundario → `text-xs text-muted-foreground`
- `CardContent` KPI → `p-4` (o `density="tight"` para densos)
- `CardContent` con tabla → `p-0`
- Grid KPI → `gap-4`
- Grid formulario denso → `gap-3`
- Colores → tokens semánticos (`success`/`destructive`/`warning`/`info`/`muted`); prohibido `text/bg-white|black|slate|gray|blue|red|green|yellow|orange-*`
- Anchos de Dialog → `dialogSize.{sm,md,lg,xl,2xl,3xl}`

**Preguntas abiertas** (contestar en el camino, no bloquean):
1. ¿`DemoAccessDialog` (landing pública) debe respetar la regla `FormDialogShell` del ERP interno o es excepción de marketing?
2. ¿`LogoPreview.tsx` está expuesto en producción? Si no, ignorar sus hardcodes.
3. ¿Existe un layout padre de bandejas que ya aplica `PageContainer`, o cada bandeja debe hacerlo?

**Estimación**: 6 lotes × ~1 turno c/u. Lotes 1–3 dan **~80% del impacto visual** — se pueden priorizar si prefieres empezar por ahí en vez de hacerlos todos.
