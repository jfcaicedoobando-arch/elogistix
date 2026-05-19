# Estándar de Tablas — Libre Carga

Toda tabla en la app debe usar `<DataTable />` de
`@/components/shared/DataTable`. Está prohibido importar directamente
`@/components/ui/table` salvo en el propio `DataTable` o en casos editables
(formularios tipo grid) registrados explícitamente en la allowlist de
`eslint.config.js`.

## Por qué

- UX consistente (densidad, sort, paginación, vacío, sticky, hover).
- Menos código duplicado.
- Tipado fuerte en columnas.
- Compatibilidad con sort server-side y paginación integrada.

## Arquitectura interna (v9.1+)

Desde la versión `9.1.0` el motor interno corre 100% sobre
[`@tanstack/react-table`](https://tanstack.com/table) v8 +
[`@tanstack/react-virtual`](https://tanstack.com/virtual) v3. No queda
lógica custom de ordenamiento (`useDataTableSort`, `useMemo` que clona y
ordena arreglos, `useEffect` que sincroniza estados paralelos). TanStack es
la única fuente de verdad del row model.

Módulos clave en `src/components/shared/dataTable/`:

- `useTableInstance.ts` — wrapper de `useReactTable`. En modo `server` usa
  `manualSorting: true` y puentea `controlledSort`/`onSortChange` con
  `onSortingChange` (`SortingState`). En modo `client` usa
  `getSortedRowModel()`.
- `columnAdapter.ts` — convierte la API legacy `DataTableColumn<T>` a
  `ColumnDef<T, unknown>` nativo. `sortValue` se mapea a `accessorFn` +
  `sortingFn` con `localeCompare` (`es-MX`, `sensitivity: "base"`).
- `columnMeta.ts` — augmenta `ColumnMeta` de TanStack para llevar
  `width`/`align`/`sticky`/`stickyRight`/`className`/`headerClassName`
  tipados. Importar en cualquier archivo que lea `column.columnDef.meta`.
- `defineColumns.ts` — helper tipado para escribir `ColumnDef<T>[]` con
  inferencia de `T` y la augmentación de meta cargada.
- `DataTableHeaderRow.tsx` / `DataTableBody.tsx` — render basado en
  `table.getHeaderGroups()` y `table.getRowModel().rows` con `flexRender`.

## API pública

`DataTable` acepta **dos formas** de columnas y elige la correcta por
heurística (`isLegacyColumns`):

1. **Legacy `DataTableColumn<T>[]`** — recomendada para los ~40 call-sites
   existentes. El adapter la convierte internamente. **No requiere cambios**.
2. **`ColumnDef<T, unknown>[]` nativo de TanStack** — recomendada para
   nuevas tablas y para la migración progresiva (Fase 2 del refactor).
   Usar `defineColumns<T>(...)` para no perder la inferencia.

### Opción 1 — API legacy (DataTableColumn)

```tsx
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

const columns: DataTableColumn<MiTipo>[] = [
  { key: "nombre", header: "Nombre", sortable: true, sortValue: (r) => r.nombre,
    render: (r) => r.nombre },
  { key: "monto",  header: "Monto",  align: "right",
    render: (r) => formatCurrency(r.monto) },
];

<DataTable
  columns={columns}
  data={rows}
  isLoading={loading}
  rowKey={(r) => r.id}
  density="comfortable"        // 'compact' | 'comfortable' | 'spacious'
  striped                      // zebra (default true)
  hoverable                    // hover row (default true)
  bordered={false}             // bordes verticales
  onRowClick={(r) => navigate(`/x/${r.id}`)}
  pagination={{
    page, totalPages, onPageChange: setPage,
    pageSize, onPageSizeChange: setPageSize,
  }}
  footer={(data) => (
    <TableRow>
      <TableCell colSpan={2}>Total</TableCell>
      <TableCell className="text-right">{sum(data)}</TableCell>
    </TableRow>
  )}
/>
```

### Opción 2 — ColumnDef nativo (recomendada para nuevo código)

```tsx
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";

const columns = defineColumns<EmbarqueRow>([
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (r) => r.expediente,
    cell: ({ row }) => <ExpedienteCell embarque={row.original} />,
    enableSorting: true,
    meta: { width: "w-[130px]", sticky: true, className: "font-medium" },
  },
  {
    id: "monto",
    header: "Monto",
    accessorFn: (r) => r.monto,
    cell: ({ row }) => formatCurrency(row.original.monto),
    enableSorting: true,
    meta: { align: "right", width: "w-[120px]" },
  },
]);

<DataTable columns={columns} data={rows} rowKey={(r) => r.id} />
```

**Equivalencias adapter** (`DataTableColumn` → `ColumnDef`):

| Legacy                        | TanStack nativo                                  |
| ----------------------------- | ------------------------------------------------ |
| `key`                         | `id` (y `accessorFn` si hay `sortValue`)         |
| `header`                      | `header`                                         |
| `render(item)`                | `cell: ({ row }) => render(row.original)`        |
| `sortable: true`              | `enableSorting: true`                            |
| `sortValue(item)`             | `accessorFn` + `sortingFn` (`localeCompare`)     |
| `width` / `align` / `sticky` / `stickyRight` / `className` / `headerClassName` | `meta: { ... }` |

> **No mezclar** ambas formas en el mismo arreglo: la heurística mira el
> primer elemento. Si necesitas migrar parcialmente, hazlo por columna →
> tabla, no a media columna.

## Sort

- **Cliente** (default, `sortMode="client"`): TanStack ordena con
  `getSortedRowModel()`. Para legacy basta `sortable` + `sortValue`. Para
  nativo, `enableSorting` + `accessorFn` (y opcionalmente `sortingFn`).
- **Servidor** (`sortMode="server"`): pasa `controlledSort` +
  `onSortChange`. El motor activa `manualSorting: true` y **no reordena**
  el array de entrada. Incluir `sortBy`/`sortDir` en el `queryKey` de
  React Query. Patrón en uso: `useEmbarquesPageState`,
  `useCotizacionesPageState`.

## Paginación

- **Servidor**: usa `pagination` integrada con `useListPageState` y
  `.range()` en Supabase. Resetea a página 0 al cambiar filtros/sort.

## Empty state

- Por defecto renderiza icono + `emptyMessage` + `emptyHint`.
- Para CTA o estado custom usa `emptyState`.

## Virtualización

`VirtualDataTable` usa la misma `useTableInstance` + `useVirtualizer`
conectado a `table.getRowModel().rows` (no al array `data` crudo). Esto
garantiza que sort/orden coincidan con la versión no virtualizada.

## Casos excepcionales (allowlist)

Las "tablas editables" tipo grid (cotizaciones, conceptos editables)
pueden seguir usando `@/components/ui/table` directamente porque requieren
inputs embebidos por celda. Están listadas explícitamente en
`eslint.config.js` (sección "Allowlist de tablas").

Antes de añadir un nuevo archivo a la allowlist, evalúa primero si encaja
en `DataTable` con un `cell` que devuelva controles de formulario.
