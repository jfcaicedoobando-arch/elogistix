
# Ola 7 — Homologación cross-app

Cuatro subagentes auditaron la app (tablas/filtros, diálogos/wizards, detalles/dashboards, tokens). Encontraron ~130 hallazgos concretos. Este plan los agrupa en 4 lotes por impacto, con reglas simples: **primero se consolidan primitivas y tokens (una sola vez), después se migran features en paralelo**.

Fuera de alcance: lógica de negocio, RLS, generadores de PDF, wizards que ya usan `WizardShell`, rutas públicas/marketing.

---

## Lote A — Tokens y variantes base (bloqueante, va primero)

Ajustes pequeños al design system que desbloquean el resto. Todo en `src/index.css`, `tailwind.config.ts`, `src/components/ui/*`.

1. **Tokens de color**
   - Eliminar `--info` (duplica `--accent` en light y dark). Sustituir usos por `accent`.
   - Mapear `state-llegada / state-en-proceso / state-cerrado` en `tailwind.config.ts` para poder escribir `bg-state-llegada/10` sin `bg-[hsl(var(--…))]`.
   - Corregir `borderRadius.sm` para que use `var(--radius-sm)`.

2. **Escala tipográfica**
   - Añadir `text-2xs` (10px) y `text-3xs` (9px) a `fontSize`. Sustituir los ~25 usos de `text-[10px]` y aislados `text-[9px]`.
   - Normalizar `text-[11px]` a `text-xs` donde la diferencia sea imperceptible.

3. **Variantes de componentes shadcn**
   - `Badge`: añadir `variant`: `success`, `warning`, `info` y `size`: `xs` — elimina ~12 sitios que hacen `variant="outline" className="bg-X/10 text-X border-X/30 text-[10px] h-4"`.
   - `Button`: añadir `variant="accent"` para reemplazar los 2 usos con clases inline.

4. **Convención de íconos** (documentar en `src/components/ui/README.md`)
   - `h-3 w-3` chips/badges · `h-4 w-4` estándar · `h-5 w-5` headers/lg · `h-6 w-6` hero.
   - Migrar los `h-3.5` de toolbars y filtros a `h-4` (no se toca todo el árbol, sólo botones de filtro/nav).

5. **Colores hardcodeados en JSX** (`bg-emerald-*`, `bg-amber-*`, `#0B1B3A`, `bg-white`) → tokens (`success`, `warning`, `primary`, `card`). ~10 archivos.

Entregable: 1 migración de config + tokens, actualización de `Badge`/`Button`, 3–4 barridos search-and-replace acotados.

---

## Lote B — Nuevas primitivas compartidas

Extraer 4 componentes que aparecen replicados en ≥5 sitios cada uno.

1. **`DetailHeader`** en `src/components/shared/`
   - Props: `backTo`, `icon?`, `title`, `subtitle?`, `badge?`, `trailing?` (acciones/total).
   - Reemplaza el patrón "back button + h1 + status + acciones a la derecha" en 6 páginas de detalle (Factura, Proforma, Proveedor, Cliente, Lead, PortalEmbarque, PortalFactura).

2. **`KpiCard` canónico compartido**
   - Consolidar la implementación de `dashboardEjecutivo/components/KpiCard.tsx` en `src/components/shared/KpiCard.tsx` con props `variant: "default"|"success"|"warning"|"info"`.
   - Elimina 4 implementaciones locales (`Compras`, `AgenteInicio`, `CrmDashboard`, `AdminDashboard`) y limpia colores hardcodeados en `ProveedorDetalle`.

3. **`DescriptionList` / `KeyValueGrid`**
   - Renderiza pares `label: valor` con estilo consistente (label en `muted-foreground`, tabular-nums opcional, grid 1/2 cols).
   - Sustituye los `<p><span className="text-muted-foreground">RFC:</span> …</p>` repetidos en `ProveedorDetalle`, `ClienteInformacionCard`, portal detalles.

4. **`PortalFiltersBar`** (o adaptador de `UnifiedFiltersBar` para portales)
   - Elimina la copia exacta de Input+Select+Select en `PortalEmbarques`, `PortalFacturas`, `PortalCotizaciones`.

Entregable: 4 componentes + 4 archivos de tests.

---

## Lote C — Migraciones de contenido duplicado

Con Lotes A y B en su lugar, aplicar a features:

1. **AlertDialog → `ConfirmActionDialog` / `DeleteConfirmDialog` / `DoubleConfirmDeleteDialog`** (21 hallazgos, `embarques/` concentra 10):
   - Eliminar `ConfirmDeleteAlert.tsx` local de costeo.
   - Migrar los AlertDialogs inline en `TabFacturacion`, `TabDocumentos`, contenedores, `EmbarqueHeaderDialogs`, `AvanzarEstadoButton`, `ReabrirEmbarqueButton`, `DesvincularCotizacionDialog`, `DialogEliminarEmbarque` (triple-confirm), `RoleChangeAlertDialog`, `OrgMembersCard`, `BackfillLegacyCard`, `FacturaPagosSection`, `DialogHistorialPagos`, portal cotización, presupuesto.

2. **Dialogs manuales → `FormDialogShell`** (6 hallazgos):
   - `DialogCancelarRep`, `DialogSustituirFactura`, `DialogHistorialPagos`, `DialogDetallePagosProveedor`, `CierreDialogs` (×2).
   - Añadir prop `extraActions` al footer del shell si es necesario para el caso de "Vista previa" de `DialogSustituirFactura`.

3. **`FacturapiOnboardingWizard`** → `FormDialogStepper` (elimina navegación manual).

4. **`FormDialogSection`** en forms con grids/headers manuales: `NuevoProveedorStep2`, `EditarProveedorBancariosFields`, `NuevaTarifaDemoraDialog`, `FacturaManualDatosFiscales`, `FacturaProveedorFormFields`, `DialogDetallePagosProveedor.sections`.

5. **Badges hardcodeados → `StatusBadge` + `statusRegistry`** (6 hallazgos):
   - Registrar `Aplicada`, `Aprobada`, `Conciliado`, `Pendiente`, `Vigente`, `Parcial` en `statusRegistry`.
   - Migrar `NcEstadoBadge`, `ESTADO_COLOR` de notas de crédito y tesorería, `VigenciaBadge`, `AvanceBadge`, `ProveedorSaludTab`.

Entregable: ~35 archivos migrados, cero cambios de comportamiento.

---

## Lote D — Tablas HTML crudas → `DataTable`

25 hallazgos. Se hacen en oleadas pequeñas para revisar diffs:

- **D.1 Notas de crédito**: extraer `notasCreditoColumns` compartidas y usarlas en `FacturaNotasCreditoTable`, `NotasCreditoRecientes` y `cxp/NotasCreditoSection`.
- **D.2 Pagos**: extraer `pagosColumns` para `FacturaPagosSection`, `DialogHistorialPagos`, `DialogDetallePagosProveedor.sections`.
- **D.3 CRM & Analítica**: `Analitica` (3 tablas), `CrmDashboard/ForecastMesCard`, `OportunidadCotizacionesList`, `Cliente360Panel`, `ImportarLeadsCsvPreview`.
- **D.4 Presupuesto**: `TabCategorias`, `TabCaptura`, `TabVsReal`.
- **D.5 Otros**: `TesoreriaConciliacion`, `TablaFlujoSemanal` (usa `getSubRows`), `SaldosBancosCard`, `HealthSlowestTable`, `comisiones/TabLiquidaciones`, `embarques/OrigenCostosSection`, `SeccionContenedoresReadonly`, `CotizacionInformativaDetalle`, `RevalidarTarifaModal`, `PortalProformaResumen`.
- **D.6 Financiero especializado**: `EstadoResultadosTable` (Profit) es el más complejo. Se mantiene como tabla especializada pero se extrae a `FinancialTable` reutilizable con `SectionHeader`/`TotalRow`/`MargenRow` compartidos.

De paso: sustituir todos los `<p>Sin X registradas.</p>` y `Array.from({length:N}).map(<Skeleton/>)` por `EmptyState` y `ListSkeleton` (incluye 27 ocurrencias ya localizadas).

Entregable: ~25 archivos, más de 500 líneas eliminadas de markup duplicado.

---

## Validación y entrega

- Cada lote acaba con: `bun run lint` limpio, `tsgo` verde, tests en verde. Cobertura no puede bajar del umbral.
- Snapshot rápido con Playwright (headless 1280×1800) de 5 rutas testigo antes/después: `/facturacion`, `/embarques/:id`, `/portal/embarques`, `/costeo/tarifas`, `/crm/analitica`.
- Test de arquitectura nuevo: prohibir `bg-emerald-*`, `bg-amber-*`, `text-[10px]`, `bg-[hsl(...)]` en `src/features/**` (con lista blanca acotada de PDFs y marketing).
- Bump de versión por lote:
  - Lote A → `13.157.0`
  - Lote B → `13.158.0`
  - Lote C → `13.159.0`
  - Lote D → `13.160.0` (final de la ola)
- Entrada en `CHANGELOG.md` por lote.

## Métrica de éxito

Al terminar la ola:
- 0 tablas HTML crudas en `src/features/**` (excepto Estado de Resultados encapsulado).
- 0 AlertDialogs inline; todas las confirmaciones pasan por 1 de los 3 componentes canónicos.
- 0 badges de estado con colores Tailwind hardcodeados (`emerald-*`, `amber-*`) fuera de `statusRegistry`.
- 0 `text-[10px]`/`text-[9px]`/`bg-[hsl(...)]` en `src/features/**`.
- 4 primitivas nuevas (`DetailHeader`, `KpiCard` compartido, `DescriptionList`, `PortalFiltersBar`) usadas en ≥4 lugares cada una.

---

## Detalles técnicos rápidos (referencia)

- `--info` es exactamente `--accent` en light y dark; el rename es indoloro.
- `text-2xs`/`text-3xs` son valores derivados de la escala existente (0.625rem / 0.5625rem).
- `DetailHeader` va bajo `PageHeader` (no lo reemplaza): `PageHeader` es para listas, `DetailHeader` para páginas de detalle con back-button.
- `FormDialogShell` ya soporta `footer` custom; sólo hay que añadir `extraActions?: ReactNode` para el caso de 3 botones.
- Las 21 confirmaciones de `AlertDialog` no cambian comportamiento — el flujo `open/onOpenChange/onConfirm/pending` ya lo abstraen los tres componentes existentes.
- El test de arquitectura vive en `src/__tests__/architecture/design-language-tokens.test.ts` (nuevo), estilo grep-based como los otros de esa carpeta.
