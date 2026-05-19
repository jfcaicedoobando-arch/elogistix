# Fase 3 — TanStack puro, sin adapter

## Estado actual (importante)

El motor de tablas **ya corre 100% sobre `@tanstack/react-table` + `@tanstack/react-virtual`** desde la Fase 1 (v9.1.0):

- No existe `useDataTableSort`.
- No hay `useMemo([...data].sort(...))` ni `useEffect` que ordene arreglos en `DataTable` / `VirtualDataTable` / `DataTableBody` / `DataTableHeaderRow` (comentarios en código lo declaran explícitamente).
- El estado de orden vive en `useReactTable` (`getSortedRowModel` en cliente, `manualSorting` en server).
- La virtualización pasa por `useVirtualizer` sobre `table.getRowModel().rows`, no sobre `data` cruda.
- Fase 2 (v9.2.0) migró 13 archivos del core (Embarques, Cotizaciones, Clientes, Proveedores, Facturación) a `ColumnDef<T>` nativo con `defineColumns` + helpers `sortByString/Number/Date` (colación es-MX).

Lo único que **incumple la directiva "estrictamente TanStack"** hoy es el **adapter `DataTableColumn<T> → ColumnDef<T>`** que sigue activo para 18 archivos legacy. Esta Fase 3 lo elimina.

## Objetivo

Dejar `DataTable` / `VirtualDataTable` aceptando **exclusivamente** `ColumnDef<T>[]` y borrar todo rastro de la API legacy.

## Pasos

### 1. Migrar los 18 archivos restantes a `ColumnDef<T>` nativo

Mismo patrón ya documentado en `docs/migracion-tabla-fase2.md` (`key`→`id`, `render`→`cell`, `sortValue`→`accessorFn`+`sortingFn`, props visuales→`meta`).

Agrupados por módulo:

- **Dashboard**: `ProfitTable.tsx`, `EmbarquesActivosTable.tsx`.
- **Admin global**: `adminUsuariosColumns.tsx`, `adminOrganizacionesColumns.tsx`, `diagnosticoColumns.tsx`, `TabPlanes.tsx`, `org-detalle/OrgMembersCard.tsx`.
- **Admin org**: `pages/admin-org/Usuarios.tsx`.
- **Configuración**: `TabTiposContenedor.tsx`, `TabPuertos.tsx`, `TabNavieras.tsx`.
- **Auditoría**: `HallazgosTabla.tsx`, `HallazgoTabla.tsx`.
- **Portal cliente**: `PortalEmbarqueDocumentos.tsx`.
- **Reportes**: `ReportesTablaClientes.tsx`.
- **Papelera / Idempotencia**: `pages/dashboard/Papelera.tsx`, `pages/dashboard/Idempotencia.tsx`.
- **Limpieza**: import muerto de `DataTableColumn` en `embarqueColumns.tsx`.

### 2. Eliminar la API legacy

- Borrar `src/components/shared/dataTable/columnAdapter.ts`.
- Quitar el tipo `DataTableColumn<T>` y `SortValue` de `src/components/shared/dataTable/types.ts` (conservar `ColumnAlign`, `SortDirection`, etc. que sigue usando `LibreCargaColumnMeta`).
- Simplificar la detección dual en `DataTable.tsx`, `VirtualDataTable.tsx` y `useTableInstance.ts`: la prop `columns` pasa a ser `ColumnDef<T, unknown>[]` directo, sin rama de `isLegacy`.

### 3. Ajustar tests

- En `DataTable.regression.test.tsx`, reemplazar los fixtures que usan `DataTableColumn<T>` por `defineColumns<T>` (manteniendo los mismos asserts).
- Conservar los 4 tests de Fase 2 (ColumnDef nativo, colación es-MX, nulls al final, meta visual).

### 4. Documentación

- Actualizar `docs/tables.md`: eliminar la sección de API legacy y la tabla de equivalencias adapter; dejar como única API `ColumnDef<T>` + `defineColumns` + `sortingFns`.
- Actualizar `docs/migracion-tabla-fase2.md` marcando el ticket como cerrado y enlazando al commit de borrado del adapter.
- Nuevo `docs/migracion-tabla-fase3.md` con el listado de los 18 archivos migrados y la nota de que el adapter quedó eliminado.

### 5. Versionado y changelog

- `APP_VERSION` → **`10.0.0`** (major, breaking change en la API pública del componente).
- Entrada nueva al inicio de `src/content/changelog/v8/chunks/0.ts` y `recentChangelog` describiendo: adapter eliminado, 18 archivos migrados, `DataTable` ahora exige `ColumnDef<T>[]`.

## Fuera de alcance

- No tocar RPCs, filtros server-side, paginación ni virtualización (el motor ya es puro TanStack).
- No cambiar el comportamiento visual ni de orden de ninguna tabla — sólo migración de forma.
- No introducir filtros client-side nuevos: las tablas que filtran lo siguen haciendo en su controlador (Supabase + RPC).

## Detalle técnico (referencia)

Equivalencias (recordatorio):

```text
key          → id
header       → header
render(row)  → cell: ({ row }) => …row.original…
sortable     → enableSorting
sortValue    → accessorFn + sortingFn (sortByString/Number/Date)
width        → meta.width
align        → meta.align
sticky       → meta.sticky / meta.stickyRight
className    → meta.className
headerClass  → meta.headerClassName
```

Para sort server-side se mantiene la API: `sortMode="server"` + `controlledSort={{ key, dir }}` + `onSortChange(key, dir)` — el `key` es el `id` declarado en el `ColumnDef`.

## Archivos afectados

**Editar** (18 callers + 5 internos):
- los 18 archivos listados en el paso 1
- `src/components/shared/DataTable.tsx`
- `src/components/shared/VirtualDataTable.tsx`
- `src/components/shared/dataTable/useTableInstance.ts`
- `src/components/shared/dataTable/types.ts`
- `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`, `src/content/changelogData.ts`
- `docs/tables.md`, `docs/migracion-tabla-fase2.md`

**Eliminar**:
- `src/components/shared/dataTable/columnAdapter.ts`

**Crear**:
- `docs/migracion-tabla-fase3.md`
