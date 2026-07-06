## Objetivo

Unificar el UX de todas las tablas de la app:

1. **Cero `<Link>` inline en celdas**: el folio, expediente, referencias, etc. dejan de ser enlaces. La navegación se hace por click en la fila completa.
2. **Drilldown por fila** donde tenga sentido (detalle de entidad).
3. **Row-click accesible**: teclado (Enter/Space), Ctrl/Cmd+click abre en pestaña nueva, click derecho ofrece "Abrir en pestaña nueva".
4. Donde no hay página de detalle, la fila abre el diálogo o modal correspondiente (mismo patrón, sin links inline).

## Fase 1 — Infraestructura

Un solo lugar concentra el comportamiento; ninguna tabla lo reimplementa.

**Cambios en `src/components/shared/dataTable/`**

- Agregar prop `getRowHref?: (row) => string | null` a `DataTable`, `DataTableBody` y `ResponsiveDataTable`.
- Cuando `getRowHref` está presente, `DataTableBody` renderiza cada `<tr>` con:
  - `role="link"`, `tabIndex={0}`, `aria-label` (derivado de `getRowAriaLabel` opcional).
  - `onClick`: si `event.metaKey || event.ctrlKey || event.button === 1` → `window.open(href, '_blank', 'noopener')`. Si no → `navigate(href)`.
  - `onKeyDown`: Enter/Space → `navigate(href)`.
  - `cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/40`.
- Se conserva `onRowClick` para tablas que abren diálogo (sin URL). Se documenta en el header: **usa `getRowHref` si hay ruta; `onRowClick` si abre modal**.
- Los controles interactivos internos (checkbox de selección, botones de acción, `DropdownMenu`) ya usan `e.stopPropagation()` — se auditan y se agrega donde falte.

**Mobile cards**

- Extraer helper `useDrilldownRow({ href, ariaLabel })` que retorna props para `<li>` / `<div>` (mismo comportamiento accesible). Reutilizado por `CarteraMobileList` y sus equivalentes portal.

## Fase 2 — Barrido por módulos

Se quita **todo** `<Link>` inline en columnas y se aplica drilldown/onRowClick según la tabla. Cada bloque es una tarea independiente para lanzar en subagentes.

**ERP · Ventas y cobranza**
- `cotizacionesColumns`, `TabProformas` (proformasColumns), `TabFacturasEmitidas` (facturacionColumns), `TabProyeccion` (proyeccionColumns), `carteraColumns`, `huecoFacturacionColumns`, `HuecoFacturacionDetalleDialog`.

**ERP · Operaciones**
- `embarqueColumns`, `EmbarquesActivosTable`, `ProfitTable` (dashboard), `EmbarquesRelacionadosCard`, `HistorialProformas`, `HistorialFacturas`, `TabConciliacion`, `ReconciliacionTresColumnas`.

**ERP · Compras / CxP**
- `cxpColumns`, `cxpAgingColumns`, `cxpPorPagarColumns`, `cxpPorCapturarColumns`, `ComprasPorAprobar`, `ComprasPagos` (pagosColumns), `ComprasNotasCredito`, `ComprasConciliacion`, `ProveedorOperacionesTable`.

**ERP · Catálogos**
- `clienteColumns` + `TablaContactos` + `TabPortalCliente` (dentro de detalle cliente), `proveedorTableColumns`, `ProveedorTable`.

**ERP · CRM y comisiones**
- `leadsColumns` (Leads), `Oportunidades`, `Actividades`, `comisionesColumns`.

**ERP · Costeo y configuración**
- `CosteoTarifasTable`, `CosteoRutasTable`, `CosteoAgentesTable`, `CosteoNavieras`, `CosteoDemorasVenta`, `tarifasColumns`, `TabNavieras`, `TabPuertos`, `TabTiposContenedor` (row-click abre edit dialog).

**Detalle de embarque (sub-tablas)**
- `TabDocumentos`, `TabCostos` (ConceptosCostoCard), `TabDemoras` (tabDemorasColumns), `TabGarantias` (useGarantiasColumns), `TabSeguros`, `TablaPnlPorMoneda`, `GrupoConceptosContenedor`, `ResumenConceptosVenta`, `PasoConfirmacionProforma`, `ProformaDetalle`. Row-click abre el edit inline correspondiente (o sin drilldown si es solo lectura tipo P&L).

**Auditoría**
- `HallazgosTabla`, `HallazgoTabla`, `hallazgosTablaSelectColumn`. Row-click abre el detalle del hallazgo.

**Portal cliente y agente**
- `PortalFacturas`, `PortalFacturaDetalle`, `PortalEmbarqueDocumentos`, `agenteTarifasColumns`, `AgenteEmbarques`, `AgenteGarantias`, `AgenteTarifas`. Convertir cards con links a fila-completa navegable (mismo helper `useDrilldownRow`).

**Admin**
- `AdminOrganizaciones`, `AdminOrganizacionesColumns`, `OrgMembersCard`, `UsuariosInternosTab` (usuariosColumns), `PortalUsuariosTab` (portalUsuariosColumns), `TabPlanes`, `DiagnosticoColumns`, `Papelera`, `Idempotencia`. Los que no tienen detalle mantienen solo acciones en menú.

**Reportes**
- `ReportesTablaClientes` (ya tiene row-click; solo estandarizar).

## Fase 3 — Regla arquitectónica

Nuevo test en `src/__tests__/architecture/`:

- `tables-no-inline-links.test.ts`: rechaza importar `Link` desde `react-router-dom` dentro de archivos `*Columns.tsx` / `*columns.tsx`. Con allowlist temporal vacía.

## Fase 4 — Versionado y bitácora

- Bump `APP_VERSION` a `13.200.0` (cambio transversal de UX).
- Entrada `CHANGELOG.md`: resumen de la estandarización + guía breve para nuevas tablas (`getRowHref` vs `onRowClick`).
- Nota en `mem://` (regla `ui-table-standardization`): registrar la política "no `<Link>` en celdas; drilldown vía `getRowHref`".

## Fuera de alcance

- No se cambia la data que muestran las tablas ni las columnas visibles.
- No se rediseña la densidad, striping ni paginación (ya estandarizados).
- No se toca la lógica de negocio (filtros, mutaciones, permisos).

## Detalles técnicos

- `getRowHref` retorna `null` para filas no navegables (fila deshabilitada, en edición, etc.) → sin cursor pointer ni role.
- La detección de "click en control interactivo interno" usa `event.target.closest('button, a, [role="menuitem"], input, [data-no-row-nav]')`. Añadimos `data-no-row-nav` a wrappers de checkboxes y dropdown triggers para asegurar consistencia.
- Ctrl/Cmd+click y middle-click abren `window.open(href, '_blank', 'noopener,noreferrer')`.
- El foco visible usa el token `--ring` (ya definido). No se hardcodean colores.
- Tests: se agregan casos a `DataTable.regression.test.tsx` para `getRowHref` (click, Ctrl+click, Enter, Space, ignorar clicks en `[data-no-row-nav]`).

## Orden de ejecución

1. Fase 1 (infra + tests) — un solo cambio, base para lo demás.
2. Fase 2 en paralelo por módulo (subagentes independientes; ningún módulo comparte archivos con otro salvo el `DataTable` compartido, que ya quedó estable en Fase 1).
3. Fase 3 (regla arquitectónica) — al final para no bloquear los subagentes durante la migración.
4. Fase 4 (changelog + memoria).
