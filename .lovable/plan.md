# Auditoría modales + principios — Plan de estandarización

## Estado actual (resumen)

**Lo bueno (no tocar):** 47 modales ya usan `FormDialogShell`, existe `PageHeader`, `DataTable`, `EmptyState`, `DoubleConfirmDeleteDialog`, `ConfirmDeleteAlert`, `MobileFiltersSheet`, tokens `dialogSize`/`scrollableDialog`, `browserStorage`. La base está sólida.

**Lo malo (deuda concentrada):**
- 3 `window.confirm` para operaciones destructivas reales (Papelera, TabSeguros, cuentas bancarias) — bug de accesibilidad.
- 14 `<Dialog>` ad-hoc sin `FormDialogShell` (Cancelar factura/REP, TabCierre, TesoreriaCuentas, MarcarRevisado, motivos de rechazo, etc.).
- 7 `<AlertDialog>` inline duplicando lo que `ConfirmDeleteAlert` ya resuelve.
- 9 `DialogContent` con `max-w-*` literal en vez de `dialogSize.*`.
- 5 Sheets de filtros mobile re-implementando `MobileFiltersSheet`.
- Patrón "motivo de rechazo" duplicado en 2 features (tarifa, factura proveedor).
- `text-white`/`bg-white`/hex hardcoded en dashboards y LogoPreview rompiendo theming.
- ~12 mutaciones de costeo sin `onError`: errores Supabase silenciosos.
- Mini-KPIs inline repetidos en `ArribosCard`, `Operaciones`, `MiOperacionWidgets`.
- ~15 `text-[10px]`/`text-[11px]` literales sin token de escala.
- 3 tablas HTML manuales fuera de `DataTable` (Tesorería, FacturaPagos).

---

## Fase 1 — Bug fixes y reuso barato (alto ROI, esfuerzo S)

1. **Eliminar 3 `window.confirm`** → migrar a `ConfirmDeleteAlert` / `DoubleConfirmDeleteDialog`.
   - `src/features/admin/routes/Papelera.tsx`
   - `src/features/embarques/components/TabSeguros.tsx`
   - `src/features/tesoreria/hooks/useTesoreriaCuentasController.ts`

2. **Crear `<ReasonDialog>` genérico** (textarea + motivo + acción destructiva) en `src/components/shared/ReasonDialog.tsx` y migrar:
   - `DialogRechazarTarifa.tsx`
   - `BotonesAprobacionFactura.tsx` (extraer el Dialog embebido).

3. **Token sweep `dialogSize.*`**: reemplazar 9 anchos hardcoded (`max-w-3xl`, `max-w-5xl`, `sm:max-w-[600px]`, `max-w-lg`) por `dialogSize.*` en `ErrorDetailsDialog`, `MarcarRevisadoDialog`, `HuecoFacturacionDetalleDialog`, `EmbarquesEstadoDialog`, `DialogCancelarFactura/Rep`, `DialogRechazarTarifa`, `BotonesAprobacionFactura`, `TesoreriaCuentas`, `TabCierre`.

4. **Sweep colores hardcoded sobre fondos semánticos**: reemplazar `text-white` → `text-{token}-foreground` en `ArribosCard`, `TimelineEstadosCard`, `MiOperacionWidgets`, `AlertasDemoraCard`, `ResumenConceptosVenta`, `PortalEmbarqueStepper`, `Operaciones`. Hex literales (`#0B1B3A`, `#2563EB`) de `LogoPreview` → tokens del design system.

5. **Agregar `onError` + `notifyError`/`notifySuccess` wrapper**: crear `src/lib/notifications.ts`, migrar las ~12 mutaciones de costeo (`useCosteoTarifas`, `useCosteoRutas`, `useCosteoAgentes`, `useNavieraCondiciones`) y las 2 de `usePapelera`.

6. **Agregar `OPTS = { shouldValidate, shouldDirty }`** a los ~10 `setValue` del wizard de cotización (`PasoDatosGenerales`, `SeccionMercanciaMaritimaFCL`, `SeccionMercanciaGeneral`, `SeccionMercanciaAerea`).

## Fase 2 — Migración a FormDialogShell + dedup (esfuerzo M)

7. **Migrar 7 AlertDialogs inline de eliminación a `ConfirmDeleteAlert`**: TabDocumentos, TabFacturacion, FilaContenedor, ListaContenedoresEditable, FacturaPagosSection, TabCategorias, OrgMembersCard.

8. **Extraer dialogs embebidos en componentes >150 LOC** a archivos propios con `FormDialogShell`:
   - `TabCierre.tsx` → `DialogCierreEmbarque.tsx` + `DialogReabrirEmbarque.tsx`.
   - `TesoreriaCuentas.tsx` → `CuentaBancariaFormDialog.tsx`.

9. **Migrar dialogs ad-hoc a `FormDialogShell`**:
   - `DialogCancelarFactura`, `DialogCancelarRep` (selects + radio).
   - `MarcarRevisadoDialog` (con Tabs internas).
   - `DialogDetallePagosProveedor` (que copia el shell a mano).
   - `PanelConciliacionMovimiento`.

10. **Refactorizar `DialogEliminarEmbarque`** (3 AlertDialogs encadenados) usando `DoubleConfirmDeleteDialog` parametrizado.

11. **Adoptar `MobileFiltersSheet`** en los 5 sheets de filtros duplicados (Cotizaciones, Embarques, Cxp, Portal embarques, Portal facturas).

## Fase 3 — Sistema visual y consolidación (esfuerzo M)

12. **Extraer `<KpiTile>` atómico** (label, icon, value, colorToken) y consumirlo en `KpiStrip`, `ArribosCard`, `Operaciones`, `MiOperacionWidgets`.

13. **Crear shell `<ReadonlyDialogShell>`** (o variante `variant="readonly"` en FormDialogShell) para dialogs de tabla/lista sin form: `HuecoFacturacionDetalleDialog`, `EmbarquesEstadoDialog`, `DialogHistorialPagos`, `DialogDetallePagosProveedor`.

14. **Tokens de tipografía sub-xs**: agregar `text-2xs` (0.625rem) y `text-xs-plus` (0.6875rem) en `tailwind.config.ts`; reemplazar ~15 `text-[10px]`/`text-[11px]` literales.

15. **Migrar 3 tablas HTML manuales a `DataTable`**: `TesoreriaConciliacion`, `TablaFlujoSemanal`, `FacturaPagosSection`.

16. **`TableToolbar` compartido** (SearchInput + filtros + export) y adoptarlo en Cotizaciones, Facturación, CxP, Compras.

17. **Split de componentes >200 LOC**: `TabPnlContenedor` (211), `EmbarqueDetalleTabs` (209), `TabDemoras` (208), `TarifaFormFields` (205).

## Fase 4 — Codificar reglas como memoria del proyecto

Añadir a `mem://`:
- **P1** Dialogs prohibidos en componentes cuyo nombre no termina en `Dialog`/`Modal`/`Sheet` (extraer a archivo propio).
- **P2** `ReadonlyDialogShell` para modales read-only con tabla/lista.
- **P3** `dialogSize.*` obligatorio — prohibido `max-w-*` literal en `DialogContent`.
- **P4** Sheet solo para filtros mobile o sidebars de contexto; nunca para formularios CRUD.
- **P5** `DoubleConfirmDeleteDialog` para operaciones irreversibles con impacto contable o multi-registro.
- **P6** `DialogDescription` obligatoria (visible o `sr-only`).
- **P7** Filtros mobile deben usar `MobileFiltersSheet` (prohibido reimplementar).
- **P8** Componente no-dialog >150 LOC con `<Dialog>` adentro → extraer modal.
- **P9** `notifyError`/`notifySuccess` obligatorios en mutaciones (no `toast()` crudo).
- **P10** `text-white`/`bg-white` prohibidos sobre fondos semánticos — usar `*-foreground`.

Cada fase termina con bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Detalles técnicos

```text
Conteo de cambios estimado:
  Fase 1: ~25 archivos, ~3 nuevos (ReasonDialog, notifications.ts, KpiTile shell)
  Fase 2: ~20 archivos, ~3 nuevos (dialogs extraídos)
  Fase 3: ~15 archivos, ~3 nuevos (ReadonlyDialogShell, KpiTile, TableToolbar)
  Fase 4: 10 archivos nuevos en mem://
```

**Fuera de alcance:** cambios funcionales de negocio, refactor de hooks de datos, cambios de rutas, modificación de RLS/edge functions.

---

## Pregunta antes de implementar

¿Apruebas el plan completo (4 fases secuenciales con bump de versión por fase), o prefieres que ejecute solo Fase 1 primero (bug fixes + reuso barato) y revisemos resultado antes de continuar con las migraciones más invasivas?
