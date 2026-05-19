## Objetivo

Eliminar la lógica custom de sort y virtualización (`useDataTableSort`, el `useMemo` que ordena arreglos, el bucle manual sobre `virtualizer.getVirtualItems()` desconectado del modelo de filas) y dejar que `@tanstack/react-table` sea la única fuente de verdad del estado de la tabla. `@tanstack/react-virtual` se mantiene pero conectado al `rowModel` de TanStack.

Filtros server-side (Supabase RPC) **no se tocan** — viven en los controllers de página y seguirán igual.

## Estrategia híbrida en 2 fases

**Fase 1 (este plan):** instalar TanStack Table, reescribir el motor interno de `DataTable` y `VirtualDataTable` manteniendo el contrato público `DataTableColumn<T>` como adapter. Migrar `Embarques` y `Cotizaciones` a un nuevo helper `defineColumns` que produce `ColumnDef<T>` nativo, sin pasar por el adapter — así sirven de referencia para la Fase 2.

**Fase 2 (futura, otro ticket):** migrar los ~38 archivos restantes de columnas a `ColumnDef<T>` nativo y borrar el adapter.

## Cambios Fase 1

### 1. Dependencia

Instalar `@tanstack/react-table` (v8). `@tanstack/react-virtual` ya está.

### 2. Nuevo módulo `src/components/shared/dataTable/`

```text
dataTable/
  types.ts                  ← se conserva DataTableColumn<T> público (adapter)
  columnAdapter.ts          ← NUEVO: DataTableColumn<T> → ColumnDef<T>
  useTableInstance.ts       ← NUEVO: useReactTable con sort controlado/uncontrolado
  defineColumns.ts          ← NUEVO: helper tipado para callers que ya quieran ColumnDef nativo
  DataTableHeaderRow.tsx    ← se reescribe sobre headerGroups de TanStack
  DataTableBody.tsx         ← se reescribe sobre table.getRowModel().rows
  (se ELIMINA) useDataTableSort.ts
```

### 3. `DataTable.tsx` — motor TanStack, API pública intacta

- Internamente convierte `DataTableColumn<T>[]` → `ColumnDef<T>[]` vía `columnAdapter`.
- Crea la instancia con `useReactTable({ data, columns, getCoreRowModel, getSortedRowModel, manualSorting: sortMode === "server", state: { sorting }, onSortingChange })`.
- `sortingState` ↔ `controlledSort` se sincroniza bidireccionalmente: cuando `sortMode === "server"` el estado viene de props (`controlledSort`) y se propaga vía `onSortChange`; cuando es "client" vive dentro de la instancia (sin `useState` paralelo, sin `useMemo` de ordenamiento, sin `useEffect`).
- Renderizado a través de `table.getHeaderGroups()` y `table.getRowModel().rows`, conservando densidad, striping, sticky, footer, paginación externa y skeletons.

### 4. `VirtualDataTable.tsx` — TanStack Table + react-virtual conectados

- Misma instancia `useReactTable` (sin `getSortedRowModel` si no se necesita; opcional según props).
- `rowVirtualizer = useVirtualizer({ count: table.getRowModel().rows.length, getScrollElement, estimateSize, measureElement })`.
- El render itera `rowVirtualizer.getVirtualItems()` y obtiene cada fila de `table.getRowModel().rows[virtualRow.index]`, no del array `data` crudo. Esto deja a TanStack como única fuente de orden/filtrado futuro.
- `VirtualRow.tsx` se simplifica para recibir una `Row<T>` de TanStack (flexRender por celda) en lugar de iterar columnas manualmente.

### 5. Migración nativa de Embarques y Cotizaciones

Para `src/components/embarque/embarqueColumns.tsx` y `src/components/cotizacion/cotizacionColumns.tsx` (el que aplique) crear columnas con `defineColumns<EmbarqueRow>()` que devuelve `ColumnDef<EmbarqueRow>[]` directo:

```text
defineColumns<EmbarqueRow>([
  { id: "expediente", header: "Expediente",
    accessorFn: r => r.expediente,
    cell: ({ row }) => <ExpedienteCell embarque={row.original} />,
    enableSorting: true },
  ...
])
```

Estas dos páginas ya usan `sortMode="server"` con `controlledSort`/`onSortChange` desde sus controllers (Supabase RPC). El refactor mapea esos handlers al `OnChangeFn<SortingState>` esperado por TanStack — sin cambiar el RPC ni los hooks de paginación server-side existentes.

`DataTable` aceptará tanto `DataTableColumn<T>[]` (legacy/adapter) como `ColumnDef<T>[]` (nativo) detectando la forma (`'render' in col` vs `'cell' in col`).

### 6. Limpieza

- Borrar `useDataTableSort.ts`.
- Quitar el `useMemo` de orden y cualquier ordenamiento manual en `DataTableBody`.
- Mantener `PaginationControls` tal cual (paginación externa controlada por el caller).

### 7. Changelog y versión

- `APP_VERSION` → `9.1.0` (minor: cambio arquitectónico de motor de tablas, API pública estable).
- Entrada en `src/content/changelog/v8/chunks/0.ts` describiendo el refactor, la Fase 2 pendiente y que Embarques/Cotizaciones ya corren con `ColumnDef` nativo.

## Verificación

- `tsc` limpio (lo corre el harness).
- Smoke manual en `/embarques` y `/cotizaciones`: ordenar columnas (server), paginar, cambiar density, hover, click de fila, sticky.
- `/admin/diagnostico` (único consumidor de `VirtualDataTable`): scroll virtual con cientos de filas y alturas variables.
- Tres páginas que usen el DataTable legacy (Clientes, Proveedores, Facturación) para confirmar que el adapter no rompe nada.

## Fuera de alcance

- Migrar los ~38 archivos de columnas restantes a `ColumnDef` nativo (Fase 2).
- Agregar filtrado client-side (`getFilteredRowModel`) — los filtros siguen en Supabase RPC.
- Agrupado, expansión de filas, row selection, column visibility / resizing.
- Cambios en RPCs, `useEmbarquesPageState`, `useCotizacionesPageState` o cualquier hook de paginación server-side.
