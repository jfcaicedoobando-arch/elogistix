## Objetivo Fase 2

Terminar el barrido iniciado en Fase 1: quitar **todos** los `<Link>` inline restantes en celdas de tabla y aplicar `getRowHref` (o `onRowClick` para modales) en las tablas que aún no lo tienen. Sin tocar columnas visibles, filtros ni lógica de negocio.

## Bloques a migrar

Cada bloque es independiente y puede lanzarse en subagentes paralelos. Ninguno comparte archivos con otro.

### Bloque A — Compras / CxP restantes
- `cxpColumns` (bandeja CxP principal), `cxpAgingColumns` (columnas restantes), `ComprasPorAprobar`, `ComprasPagos` (pagosColumns), `ComprasNotasCredito`, `ComprasConciliacion`.
- `ProveedorOperacionesTable`: quitar `<Link>` del expediente (línea 54) → `getRowHref` a `/embarques/:id`.

### Bloque B — Operaciones / embarques
- `TabConciliacion`: reemplazar `<Link>` a `/cxp?factura=...` por celda plana; navegación desde row-click de la sub-tabla si aplica.
- `ReconciliacionTresColumnas`, `HistorialProformas` (ya en Fase 1, revalidar), `HistorialFacturas` (ya en Fase 1, revalidar).
- `EmbarquesPendientesAdminCard`, `CierreAdminBlock` (dashboard finance): quitar Links, `getRowHref` a detalle.

### Bloque C — Sub-tablas de detalle de embarque
- `TabDocumentos`, `TabCostos` (`ConceptosCostoCard`, `GrupoConceptosContenedor`), `TabDemoras` (`tabDemorasColumns`), `TabGarantias` (`useGarantiasColumns`), `TabSeguros`, `TablaPnlPorMoneda`, `ResumenConceptosVenta`, `PasoConfirmacionProforma`.
- Row-click abre el edit inline correspondiente vía `onRowClick` (no hay ruta). `TablaPnlPorMoneda` y otras de solo lectura quedan sin drilldown pero sin Links.
- `ProformaDetalleCards`: quitar `<Link to="/facturacion/:id">` (línea 64) por texto plano + botón "Ver factura" en la card.

### Bloque D — CRM, comisiones, costeo y catálogos
- `Actividades` (CRM), `comisionesColumns`.
- Costeo: `CosteoTarifasTable`, `CosteoRutasTable`, `CosteoAgentesTable`, `CosteoNavieras`, `CosteoDemorasVenta`, `tarifasColumns`.
- Configuración: `TabNavieras`, `TabPuertos`, `TabTiposContenedor` — row-click abre edit dialog (`onRowClick`).
- Catálogos restantes: `proveedorTableColumns`, `ProveedorTable`, `TablaContactos` (dentro de ClienteDetalle), `TabPortalCliente`.

### Bloque E — Auditoría
- `HallazgosTabla`, `HallazgoTabla`, `hallazgosTablaSelectColumn`.
- Row-click abre el detalle del hallazgo (dialog o ruta según patrón existente).

### Bloque F — Portal cliente y agente
- `PortalFacturas`: quitar `<Link>` de la fila (línea 90) → `getRowHref` a `/portal/facturas/:id`.
- `PortalFacturaDetalle`: quitar `<Link>` a embarque (línea 108) por botón "Ver embarque" en el header/card.
- `PortalEmbarqueDocumentos`, cards `EmbarqueCard`, `PortalEmbarquesRecientesCard`, `PortalProximosArribosCard`, `PortalEstadoEmbarquesCard`, `PortalFacturacionPendienteCard`: convertir a fila/card completa navegable con `useDrilldownRow` (helper de Fase 1).
- Agente: `AgenteInicio`, `agenteTarifasColumns`, `AgenteEmbarques`, `AgenteGarantias`, `AgenteTarifas`.

### Bloque G — Admin restantes
- `AdminOrganizacionesColumns`, `OrgMembersCard`, `UsuariosInternosTab` (usuariosColumns), `PortalUsuariosTab` (línea 53: quitar `<Link>` de ficha).
- `TabPlanes`, `DiagnosticoColumns`, `Papelera`, `Idempotencia`: los que no tienen detalle mantienen solo menú de acciones (sin Links inline).

### Bloque H — Otros con Link inline detectados
- `AvisoProformasRechazadas` (facturación): quitar `<Link>` — usar botón.
- `FacturaResumenCard`, `AccionesProforma`: revisar; si el Link está en botón/acción, se conserva (los botones-link son válidos, solo se prohíben Links en celdas de tabla y en filas de card-lista).

## Fase 3 — Regla arquitectónica (al cierre)

Nuevo test `src/__tests__/architecture/tables-no-inline-links.test.ts`:
- Falla si un archivo `*Columns.tsx` / `*columns.tsx` importa `Link` de `react-router-dom`.
- Allowlist vacía al inicio; si algún archivo lo requiere, se documenta con `// @allow-inline-link` y justificación.

## Fase 4 — Versionado y bitácora

- Bump `APP_VERSION` a `13.201.0` (continuación del cambio transversal).
- Entrada `CHANGELOG.md` con bloques migrados.
- Actualizar memoria `ui-table-standardization` con la política final consolidada.

## Fuera de alcance

- Columnas visibles, orden, filtros, densidad, striping, paginación.
- Lógica de negocio, permisos, queries.
- Botones-link fuera de tablas (headers, toolbars, breadcrumbs, menús): se conservan.

## Detalles técnicos

- Toda navegación desde tabla usa `getRowHref` (rutas) o `onRowClick` (modales) — nunca ambos en la misma fila.
- Cards-lista (portal) usan `useDrilldownRow({ href, ariaLabel })` de Fase 1 para tener el mismo comportamiento accesible (Enter/Space, Ctrl/Cmd+click, foco visible).
- Botones y menús dentro de la fila ya llevan `e.stopPropagation()` o `data-no-row-nav`; se audita fila por fila.
- Cero cambios en columnas visibles: solo se sustituye `<Link>...</Link>` por `<span>` / texto plano manteniendo estilos.
- Tests existentes de cada tabla se actualizan solo si asertaban sobre el `<a>` interno.

## Orden de ejecución

1. Bloques A–H en paralelo por subagentes (uno por bloque).
2. Fase 3 (test de arquitectura) — al final, cuando todos los bloques terminaron.
3. Fase 4 (APP_VERSION + CHANGELOG + memoria).
