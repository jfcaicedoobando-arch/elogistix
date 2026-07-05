# Plan: Filtros globales server-side + URL sync para todas las tablas

## Estado actual

Ya existen las piezas base (no hay que inventarlas):

- **`useListPageState`** / **`useTableFilters`** — hooks con `nuqs` que sincronizan `q`, `page`, `ps`, filtros y rango de fechas con la URL.
- **`<UnifiedFiltersBar />`** — barra estándar con search + slots primarios + Sheet mobile + chips activos + "Limpiar todo".
- **`<DataTable>`** — soporta `sortMode="server"` con `controlledSort` + `onSortChange` y `pagination` (page, pageSize, totalPages).
- **`PaginationControls`** — control unificado con selector de tamaño de página.

Ya usan el patrón completo:
Facturación (`useFacturacionPageController`), Embarques (`useEmbarquesPageState`), Cotizaciones (`useCotizacionesPageController`), Clientes, Proveedores, CxP.

Faltan por unificar (server-side + nuqs + `UnifiedFiltersBar`): **~35 tablas** en Cartera, bandejas CxP, Comisiones, CRM, Portal cliente/agente, Admin, Configuración, Costeo, Auditoría.

## Por qué se propone en fases

Migrar 35 tablas a server-side en un solo turno es inviable: cada tabla requiere (1) nuevo query `.range()` o RPC en Supabase, (2) hook paginado tipado, (3) columnas con `sortingFn` retiradas y `controlledSort`, (4) barra de filtros, (5) tests. Un pase monolítico rompería cosas y no cabría en una respuesta. Se propone entregar por olas verificables.

## Arquitectura común (una sola vez, aplica a todas las olas)

Antes de la primera ola creamos los cimientos reutilizables:

1. **`useServerPagedList<TRow, TFilters>`** en `src/hooks/shared/` — wrapper que combina `useTableFilters` + `useQuery` + orden controlado. Firma:
   ```text
   useServerPagedList({
     queryKey, fetcher: ({ search, filters, sort, from, to, range }) => Promise<{rows, count}>,
     defaultFilters, filterLabels, defaultSort, defaultPageSize
   })
   ```
2. **`buildPagedFetcher(supabase, tableOrRpc, columns, mappers)`** — helper que arma un query `.range(from,to)` con `count: 'exact'`, aplica search y filtros, y devuelve `{rows, count}`.
3. **`sortableColumn<T>()`** — builder en `columnBuilders.tsx` que declara `id` sin `sortingFn` (server-sort) y con `enableSorting: true`, para no dejar builders inconsistentes.
4. **Test de arquitectura** `server-paged-lists.test.ts` — falla si una lista importa `DataTable` sin `sortMode="server"` y sin `pagination`. La allowlist arranca con las listas ya migradas.

## Olas de migración

### Ola 1 — Cierre de bandejas financieras (bloque solicitado)
Tablas: **Cartera**, **CxpPorPagar**, **CxpPorCapturar**, **CxpAging**, **Comisiones**.

Para cada una:
- Reescribir hook (`useCarteraPendiente`, `useBandejasCxp*`, `useComisiones`) para devolver `{ rows, count }` con `.range()`, orden y filtros aplicados en servidor.
- Agregar barra con `search`, filtros de moneda/estado/rango de fechas, chip de vencidas.
- Retirar `sortingFn` cliente en columnas y activar `controlledSort`.
- Actualizar tests unitarios/arquitectura.

### Ola 2 — CRM
Tablas: **Leads**, **Oportunidades**, **Actividades**.
- Reemplazar filtros locales existentes por `UnifiedFiltersBar`.
- Mover el orden actual (cliente) a server-side con `.range()`.

### Ola 3 — Portales (cliente + agente)
Tablas: `PortalEmbarques`, `PortalFacturas`, `PortalCotizaciones`, `AgenteTarifas`, `AgenteGarantias`, `AgenteEmbarques`, `PortalEmbarqueDocumentos`.
- `PortalFiltersBar` se retira y todos los portales pasan a `UnifiedFiltersBar` con el mismo tema.
- Los RPCs de portal (`portal_*`) ya existentes se extienden con `p_from`, `p_to`, `p_sort_key`, `p_sort_dir`.

### Ola 4 — Admin y Auditoría
Tablas: `AdminOrganizaciones`, `Papelera`, `Idempotencia`, `UsuariosInternosTab`, `PortalUsuariosTab`, `OrgMembersCard`, `HallazgoTabla`, `HallazgosTabla`, `TabPlanes`.
- Estos hoy no tienen filtros; se añaden search + estado + fecha según aplique.

### Ola 5 — Costeo y Configuración
Tablas: `CosteoTarifasTable`, `CosteoRutasTable`, `CosteoAgentesTable`, `CosteoNavieras`, `CosteoDemorasVenta`, `TabPuertos`, `TabNavieras`, `TabTiposContenedor`.
- Muchas son catálogos con <500 filas: para ellas hacemos server-fetch + orden y paginación server, aun cuando el search sea trivial, para mantener consistencia.

### Ola 6 — Tablas dentro de detalle
Tablas: `TabCostos`, `TabConciliacion`, `TabDocumentos`, `TabPortalCliente`, `TablaContactos`, `TabProyeccion`, `EmbarquesActivosTable`, `ProfitTable`, `ProveedorOperacionesTable`, `HuecoFacturacionDetalleDialog`.
- Aquí sí es aceptable orden cliente cuando la tabla vive dentro de un detalle con dataset pequeño; se homologa la barra pero se documenta la excepción en el test de arquitectura.

## Detalles técnicos

- **URL sync (`nuqs`)**: `q`, `page`, `ps`, `sort`, `dir`, `from`, `to` + un slug por filtro. Defaults nunca se serializan (URL queda limpia).
- **RLS/permisos**: cada nuevo `.range()` se prueba contra las policies existentes. No se tocan policies salvo que un filtro necesite índice adicional.
- **Índices**: se añade índice compuesto en las columnas usadas para orden por default (ej. `facturas(fecha_emision desc)`), como migración separada por ola.
- **Compatibilidad**: los hooks legados quedan `@deprecated` un release antes de borrarse; el consumidor los reemplaza en el mismo commit de su ola.
- **CHANGELOG + APP_VERSION**: se registra una entrada por ola con la lista de rutas migradas.

## Verificación

- Tests unitarios de cada hook nuevo (mocking Supabase).
- Test de arquitectura `server-paged-lists.test.ts` como guardrail.
- Playwright: 1 spec por ola verificando URL, chips, orden y paginación.
- Typecheck completo tras cada ola.

## Entrega

Cada ola se implementa en un mensaje independiente para que puedas revisarla y aprobarla antes de continuar. Este plan solo cubre la **Ola 1** en el siguiente turno (Cartera, CxP×3, Comisiones); las olas 2-6 se abren cuando confirmes.

---

**Analogía**: hoy la app tiene una barra de filtros "de referencia" muy buena, pero solo unas cuantas tablas la usan bien. Es como si tuvieras un uniforme oficial pero la mitad de los empleados sigue con su ropa. En vez de cambiar a los 35 al mismo tiempo (caos), los vestimos en 6 turnos, empezando por el equipo de finanzas.
