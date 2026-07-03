# Oleada 2 — Migración de módulos maduros a primitivas

Consumir las 9 primitivas creadas en la Oleada 1 en los módulos que ya tienen buen "design language" pero duplican patrones. Sin cambios de negocio ni de UX visible salvo consistencia.

## Módulos en scope (maduros, mismo patrón: lista + filtros + tabla + detalle)

1. **Facturación** (`src/pages/Facturacion.tsx` + `src/features/facturacion/`)
2. **Proformas** (`src/pages/Proformas.tsx` + `src/features/proformas/`)
3. **Cotizaciones** (`src/pages/Cotizaciones.tsx` + `src/features/cotizacion/`)
4. **Embarques** (`src/pages/Embarques.tsx` + `src/features/embarques/`)
5. **Clientes** (`src/pages/Clientes.tsx` + `src/features/cliente/`)

CRM, Costeo, CxP, Auditoría y Admin quedan para la Oleada 4 (legacy con estructura distinta).

## Cambios por página (patrón repetido)

Para cada uno de los 5 módulos:

### A. Contenedor y header
- Envolver el contenido en `<PageContainer>` (quita padding/max-width local duplicado).
- Reemplazar el header manual por `<PageHeader title description icon actions>`. Si tiene tabs internos, moverlos al slot `tabs`.

### B. Estados de carga/error/vacío
- Reemplazar spinners locales por `<LoadingState>`.
- Reemplazar tarjetas de error por `<ErrorState onRetry>`.
- Reemplazar skeletons ad-hoc por `<ListSkeleton variant="table">`.

### C. Badges de estado
- Reemplazar `getEstadoColor`, `BadgeCiclo`, `EmbarqueBadgeAdmin`, `renderEstadoVigencia` en las columnas por `<StatusBadge domain={...}>`.
- Los helpers viejos quedan marcados `@deprecated` (no se borran hasta la Oleada 6).

### D. Filtros
- Reemplazar la barra de filtros custom por `<UnifiedFiltersBar>` alimentado por `useTableFilters`.
- Mantener filtros secundarios de cada dominio en el slot `secondary`.
- Chips activos derivados automáticamente.

### E. Columnas de tabla
- Migrar columnas repetidas a los builders:
  - Estado → `statusColumn({ domain, accessor })`
  - Cliente → `clientColumn({ accessor })`
  - Monto → `moneyColumn({ accessor, currencyAccessor })`
  - Fecha (folio/emisión/etc.) → `dateColumn({ accessor })`
  - Menú de acciones → `actionsColumn({ items })`
- Columnas específicas del dominio (folio, estatus operativo, etc.) quedan tal cual.

### F. Diálogos de confirmación
- Reemplazar los `AlertDialog` inline de "¿Estás seguro?" por `<ConfirmActionDialog>`.
- Los de eliminación destructiva (typable ELIMINAR) usan `<DeleteConfirmDialog>`.
- Preview PDF (proforma, factura, cotización) unifica al `<DocumentPreviewDialog>`.

## Guardrails y no-cambios

- Sin tocar RPCs, RLS, edge functions ni forma de datos.
- Sin renombrar rutas ni props públicos de hooks/servicios.
- Cada archivo tocado sigue Power of 10 (≤ 200 líneas). Si al migrar un `.tsx` de página crece, se extraen sub-componentes.
- Tokens semánticos: cero `text-white` / `bg-[#..]`.
- Retirar del `knip.json > ignore` cada primitiva conforme sus consumidores queden mergeados (`columnBuilders`, `DeleteConfirmDialog`, `DocumentPreviewDialog`, `UnifiedFiltersBar`).

## Tests

- Antes de mergear cada módulo: correr sus tests actuales + los tests de primitivas de la Oleada 1.
- Agregar `useXxxPageController.test.tsx` cobertura para el cableado de `useTableFilters` si no existe.
- No bajar thresholds; si algo baja, escribir tests del nuevo cableado.

## Estrategia de entrega

Ejecuto los 5 módulos en **subtareas paralelas** (subagentes), en 2 lotes para evitar conflictos:

- **Lote A**: Facturación + Proformas + Cotizaciones (comparten `EnviarDocumentoDialog` y helpers financieros).
- **Lote B**: Embarques + Clientes.

Cada lote:
1. Migración de archivos.
2. Correr `bun run lint` y los tests del módulo.
3. Retirar entradas de `knip.json` cuando corresponda.

## Bump y changelog

Un único bump `13.151.0` al cerrar la Oleada 2, con changelog listando los 5 módulos migrados y los helpers marcados como deprecated.

## Cierre Oleada 2

Al terminar la Oleada 2 quedamos listos para la Oleada 3. **No** borrar `plan.md` todavía — eso es el último paso del último wave.

---

# Oleada 3 — Formularios y wizards

Homologar los modales tipo formulario que aún renderizan `Dialog` crudo, y unificar los wizards multi-paso bajo un único shell.

## Lote A — Modales tipo formulario → `FormDialogShell`

Migración uno-a-uno (sin cambios de negocio) para los ~9 dialogs de formulario que aún usan `Dialog` + `DialogHeader/Footer` manuales:

- `MarcarRevisadoDialog` (auditoría) ✅ v13.152.0
- `EmbarquesEstadoDialog` (operaciones) ✅ v13.152.0
- `RespuestaClienteManualDialog` (proformas) ✅ v13.152.0
- `EnviarProformaDialog` → reusar `EnviarDocumentoDialog` (compartido).
- `EnviarCotizacionDialog` → reusar `EnviarDocumentoDialog`.
- `HuecoFacturacionDetalleDialog` (revisar si es detalle o form).
- `TrackingConfirmFechaLlegadaDialog` → migrar a `ConfirmActionDialog` (no es form).
- `PortalCambiarPasswordDialog` → dedupe con `shared/dialogs/CambiarPasswordDialog`.
- `ProveedoresImportDialog` → reusar `BulkImportDialog`.

**Excluidos**: `ErrorDetailsDialog`, `DocumentPreviewDialog`, `DeleteConfirmDialog`, `ConfirmActionDialog`, `DoubleConfirmDeleteDialog`, `PortalCotizacionConfirmDialog`, `DesvincularCotizacionDialog`, `RoleChangeAlertDialog`, `ConfirmSinDesgloseDialog` (son confirm/preview/alert — usan primitivas dedicadas).

## Lote B — WizardShell unificado

Crear `WizardShell` en `src/components/shared/wizard/` que envuelva `FormDialogShell` con:

- Contexto `useWizard()` (step actual, avanzar/retroceder, validación por paso).
- Slot `pasos: WizardStep[]` con `{ id, label, canProceed, render }`.
- Footer inteligente: Atrás / Cancelar / Siguiente / Finalizar según posición.
- Reutiliza `FormDialogStepper` existente.

Migrados a `WizardShell` (v13.152.2):

- Wizard de Cotización (`CotizacionWizardLayout`) — footer custom con "Cotizar sin desglose".
- Wizard de Embarque (`EmbarqueWizardLayout`) — footer default.

**Excluidos** (no migran a `WizardShell`):

- `FacturapiOnboardingWizard` — es un wizard **modal**, no de página completa. Ya usa `FormDialogShell` con `step/totalSteps/stepLabels`, que es el patrón de wizard modal del design system.
- `CrearProveedorDesdeCfdiDialog` — es un form de un solo paso (2 campos), no un wizard. El flujo de "2 pasos" (subir XML + confirmar) lo orquesta el parent `DialogNuevaFacturaProveedor`.

## Cierre Oleada 3 (v13.153.0)

- Lote A: 3 dialogs a `FormDialogShell` + 1 a `ConfirmActionDialog`; el resto ya reusaba shells compartidos.
- Lote B: `WizardShell` creado y consumido por los 2 wizards de página; 6 tests de cobertura (header, back, footer default primer/último paso, `isBusy`, footer custom).
- Siguiente: Oleada 4 (módulos legacy — CRM, Costeo, CxP, Auditoría, Admin).


---

# Oleada 4 — Módulos legacy (v13.154.0)

Migración de routes legacy a las primitivas de la Oleada 1 (`PageContainer`, `PageHeader`, `LoadingState`/`ErrorState`/`ListSkeleton`, `StatusBadge`). Guardrails: sin cambios de RPCs, hooks, RLS ni props públicos. Cero `text-white`/`bg-[#..]`/`style` estático.

## CRM (`src/features/crm/routes/`)
Migrados: CrmDashboard, Leads, Oportunidades, Actividades, Analitica, MiDia, Configuracion, LeadDetalle, OportunidadDetalle. `CrmLayout` conserva su subheader propio.

## Costeo (`src/features/costeo/routes/`)
Migrados: CosteoTarifas, CosteoBuscar, CosteoAgentes, CosteoRutas, CosteoNavieras, CosteoDemorasVenta. `CosteoTarifasFiltros` queda fuera de `UnifiedFiltersBar` (barra compleja con presets propios).

## CxP (`src/features/cxp/routes/`)
Migrados: Cxp, Compras, CxpAging. `CxpFiltros` conserva su bar custom (multi-tab).

## Auditoría (`src/features/auditoria/routes/`)
Migrado: AuditoriaPage (tabs vía slot `PageHeader.tabs`). `HallazgosFiltros` conserva su bar custom.

## Admin (`src/features/admin/routes/`)
Migrados: AdminLayout, AdminDashboard, Diagnostico, SentryDiagnostico, admin-org/Configuracion. Resto ya alineado con primitivas.

## Verificación
- `bun run lint` limpio.
- `bunx vitest run` sobre CRM/Costeo/CxP/Auditoría/Admin: 119 files / 827 tests en verde.

## Siguiente
Oleada 6 (limpieza de helpers deprecated y knip).

---

# Oleada 5 — Dashboards ejecutivos, bandejas y catálogos (v13.155.0)

Envolver rutas legacy en `PageContainer` para uniformar padding/max-width. Sin cambios de negocio.

Migrados: `Dashboard`, `Bitacora`, `Ayuda`, `Proveedores`, `Reportes`, `CierreMensual`, los 4 de Profit, los 4 de Tesorería, `Cartera`, `CxpPorCapturar`, `CxpPorPagar`, `Operaciones`.

Fuera de scope: portales cliente/agente (mantienen su propio shell `max-w-7xl` en el layout).

Verificación: `bun run lint` limpio, tsgo verde, 310 tests del bloque afectados en verde.

