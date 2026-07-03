# Plan de homologación de Design Language

Objetivo: unificar la experiencia visual y reducir código duplicado creando **primitivas compartidas** y migrando módulos legacy en oleadas priorizadas por impacto visible.

Los 5 subagentes coinciden en un mismo patrón: **existen componentes base (PageHeader, FormDialogShell, EmptyState, DataTable) pero adopción parcial**, con módulos maduros (Facturación, Proformas, Embarques, CxP) al día y módulos legacy (CRM, Cotizaciones, Clientes, Comisiones, Tesorería) rezagados.

---

## Hallazgos consolidados

### 1. Page shell (headers / layouts)

- `PageHeader` existe pero módulos CRM aplican doble padding (`Layout.tsx` ya da `p-4 sm:p-6` y `Leads.tsx:50`, `Analitica.tsx:43` lo repiten).
- `space-y-4` vs `space-y-6` inconsistente entre páginas → saltos visuales al navegar.
- Tabs, subheaders (`CrmSubheader`) y acciones se montan fuera del header sin slot estandarizado.

### 2. Dialogs / modales

- ✅ Correcto: `NuevoClienteDialog`, `DialogNuevaFacturaProveedor`, `DialogEnviarCfdi`.
- ❌ Violaciones a `FormDialogShell`: `EnviarProformaDialog`, `RespuestaClienteManualDialog`, `DialogSustituirFactura`, `CierreDialogs` (Cerrar/Reabrir embarque).
- Faltan 3 wrappers: `DeleteConfirmDialog` (typable ELIMINAR), `ConfirmActionDialog` (destructive/accent), `DocumentPreviewDialog` (PDF viewer).

### 3. Tablas, filtros y toolbars

- Unified Filter Bar solo en Facturación / Proformas / Embarques / CxP.
- Legacy sin chips ni date range: **Clientes, Comisiones, Leads, Oportunidades, Cotizaciones**.
- 4 hooks casi-duplicados: `useFacturacionDateRange`, `useListPageState`, `useCxpPageState`, `useEmbarquesPageController`, `useTabProformasController`.
- Celdas repetidas en 5+ archivos: estado (Badge), cliente (toTitleCase + truncate), monto (formatCurrency + tabular-nums).

### 4. Status badges (fragmentación crítica)

- 4 helpers paralelos: `getEstadoColor` (facturación), `BadgeCiclo` (proformas), `EmbarqueBadgeAdmin`, `renderEstadoVigencia` (cotizaciones). Cada uno remapea strings de BD → variantes de Badge.
- No hay `<StatusBadge domain="..." status={s} />` unificado.

### 5. Estados vacíos / loading / error

- Existe `EmptyState` pero conviven `EmptyStateInline`, `TarifasEmptyState`, `EmbarquesEmptyState` + variantes ad-hoc en Tesorería (`TesoreriaCuentas.tsx:55`, `TesoreriaConciliacion.tsx:64`).
- No hay `LoadingState` ni `ErrorState` — se usan `Loader2` centrados a mano y bucles de `Skeleton` sin componente.
- Errores de `useQuery` se manejan solo con toast; el bloque de contenido queda vacío o roto.

### 6. Design tokens

- Hardcode de colores en 30+ ubicaciones (`text-white`, `bg-white`, `bg-black/80`, `bg-[#...]`) — cards de dashboard, marketing landing, overlays de Sheet/AlertDialog, FacturaFiscalCheckAlert (amber-50/900).
- `style={{ color }}` estático en OperadorCard, EmbarquesEstadoDialog, ClienteExpandible.
- Iconos con tamaños inconsistentes (h-3 / h-3.5 / h-4 / h-5) sin criterio.
- Tokens PDF (`src/pdf/theme/tokens.ts`) desincronizados de Tailwind.

---

## Estrategia de implementación

**Regla de oro**: crear/consolidar primero las primitivas, después migrar. Cada oleada bumpea `APP_VERSION` y actualiza `CHANGELOG.md`.

### Oleada 1 — Primitivas compartidas (fundamento, sin cambio visual notorio)

Todo bajo `src/components/shared/`:

1. `**PageContainer**` — extrae el div de padding/max-w de `Layout.tsx:61`. Elimina doble padding en CRM.
2. `**PageHeader` extendido** — agrega slots `tabs`, `subHeader`, `actions` con `gap-2` estándar. Reemplaza `CrmSubheader`.
3. `**StatusBadge**` — `<StatusBadge domain="factura|proforma|embarque|cotizacion|lead" status={s} />`. Consolida los 4 helpers en `src/lib/status/statusRegistry.ts` (map dominio → {label, variant, icon}).
4. `**LoadingState**` y `**ErrorState**` en `src/components/shared/states/`. `ErrorState` con botón "Reintentar".
5. `**ListSkeleton**` — recibe `rows`, `variant` (table|card). Elimina bucles ad-hoc en Tesorería.
6. **Wrappers de Dialog** — `ConfirmActionDialog`, `DeleteConfirmDialog` (typable), `DocumentPreviewDialog` sobre `FormDialogShell` cuando aplique.
7. `**columnBuilders**` en `src/components/shared/dataTable/columnBuilders.tsx`: `statusColumn`, `clientColumn`, `moneyColumn`, `dateColumn`, `actionsColumn`.
8. `**useTableFilters<T>**` hook genérico que sustituye a los 5 hooks ad-hoc — search + URL sync + date range + secondary filters. Conserva shape de retorno estable para migración incremental.
9. `**<UnifiedFiltersBar>**` consumiendo `useTableFilters` — primary/secondary filters + chips activos + botón Sheet.

Tests unitarios para las 9 primitivas. Sin migración de páginas aún.

### Oleada 2 — Adopción en módulos maduros (validar primitivas contra código ya bueno)

Reemplaza implementaciones locales por las primitivas, sin cambiar UX:

- Facturación, Proformas, Embarques, CxP → usan `UnifiedFiltersBar`, `useTableFilters`, `StatusBadge`, `columnBuilders`.
- `DialogEnviarCfdi` ya usa Shell; verificar consistencia con `EnviarProformaDialog` (ver oleada 3).

Objetivo: probar que las primitivas cubren todos los casos actuales antes de exponerlas a módulos legacy.

### Oleada 3 — Corrección de violaciones a FormDialogShell

Migrar a `FormDialogShell` + secciones + footer sticky:

- `EnviarProformaDialog` → alinear con `DialogEnviarFacturaBranded` (que ya usa el shell compartido `EnviarDocumentoDialog`). **Idealmente reusar `EnviarDocumentoDialog**` en vez de rehacer, cerrando la homologación del turno pasado.
- `RespuestaClienteManualDialog`
- `DialogSustituirFactura` (wizard con `FormDialogStepper`)
- `CierreDialogs` (Cerrar/Reabrir embarque)

### Oleada 4 — Migración de módulos legacy a Unified Filters + StatusBadge

En orden de tráfico:

1. **Cotizaciones** — `Cotizaciones.tsx` gana date range en Sheet + chips + StatusBadge.
2. **Clientes** — de `SearchInput` a `UnifiedFiltersBar` con filtro por tipo/moneda/estado.
3. **Leads** y **Oportunidades** (CRM) — chips por estado, filtro por vendedor.
4. **Comisiones** — filtros por periodo consistentes.
5. **Tesorería** (Cuentas, Conciliación, Flujo) — reemplaza empty/loading ad-hoc por `EmptyState`/`LoadingState`/`ListSkeleton`.

### Oleada 5 — Limpieza de tokens y hardcode

- Sustituir hardcode top 30 por tokens semánticos (`text-primary-foreground`, `bg-card`, `bg-warning/15`, `text-warning`, etc.).
- Overlays de `sheet.tsx`, `alert-dialog.tsx`: `bg-black/80` → `bg-background/80`.
- Eliminar `style={{ color }}` de `OperadorCard`, `EmbarquesEstadoDialog`, `ClienteExpandible` — usar clases Tailwind con tokens.
- Estandarizar iconos: `h-4 w-4` en botones/acciones, `h-5 w-5` en encabezados. Documentar en `mem://style/theme`.
- Sincronizar `src/pdf/theme/tokens.ts` con `tailwind.config.ts` vía export shared.

### Oleada 6 — Guardrails para no regresar

- Test de arquitectura `src/__tests__/architecture/design-language.test.ts`: bloquea nuevos `text-white`/`bg-white`/`bg-[#..]` fuera de whitelist (marketing landing, PDF).
- Test que valida que todo `Dialog` con inputs use `FormDialogShell` o herede de él.
- Regla ESLint (o test de arquitectura) contra `style={{` estático.
- Nueva memoria `mem://style/design-language-primitives` con inventario y reglas.

---

## Detalles técnicos

**Rutas nuevas**:

- `src/components/shared/PageContainer.tsx`
- `src/components/shared/StatusBadge.tsx` + `src/lib/status/statusRegistry.ts`
- `src/components/shared/states/{LoadingState,ErrorState,ListSkeleton}.tsx`
- `src/components/shared/dialogs/{ConfirmActionDialog,DeleteConfirmDialog,DocumentPreviewDialog}.tsx`
- `src/components/shared/dataTable/columnBuilders.tsx`
- `src/components/shared/filters/UnifiedFiltersBar.tsx`
- `src/hooks/shared/useTableFilters.ts`

**Rutas a extender**: `src/components/shared/PageHeader.tsx` (slots `tabs`, `subHeader`), `src/components/layout/Layout.tsx` (delegar a `PageContainer`).

**Rutas a deprecar (con wrapper de compat)**: `useFacturacionDateRange`, `useListPageState`, `useCxpPageState`, `useEmbarquesPageController`, `useTabProformasController`, `EmptyStateInline`, `TarifasEmptyState`, `EmbarquesEmptyState`, `BadgeCiclo`, `EmbarqueBadgeAdmin`, `renderEstadoVigencia`.

**Alcance excluido** (no tocar en esta auditoría): lógica de negocio, edge functions, esquemas de BD, permisos/RLS, integraciones (FacturApi, Gemini, Frankfurter), tests de negocio, PDF de facturación fiscal.

---

## Entrega en incrementos

Cada oleada es un incremento independiente con su propio bump de versión y entrada en `CHANGELOG.md`. Se pueden pausar entre oleadas para validar visualmente antes de continuar.

**¿Empezamos con la Oleada 1 (primitivas) o prefieres que arranque por un submódulo puntual (ej. sólo StatusBadge, o sólo migrar Cotizaciones)?  Solo haz un plan detallado y guárdalo. Lo vamos a usar más adelante.**

---

## Cierre del plan

Una vez completada la Oleada 6 (guardrails), el último paso es eliminar este archivo del plan (`.lovable/plan.md`) para indicar que la auditoría de design language quedó cerrada.