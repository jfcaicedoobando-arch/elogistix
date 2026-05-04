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

## API rápida

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

## Convenciones de columnas

- `key` corto, alineado a campo DB cuando aplique.
- `width` con clases Tailwind (`w-[120px]`, `min-w-[140px]`).
- Numéricos: `align: 'right'` + formatter de `lib/formatters` o `lib/financial`.
- Fechas: `formatDate` (DD/MM/YYYY).
- Estados: `getEstadoColor` / `uiMappings`.
- Acciones: columna con `stickyRight` y handlers con `e.stopPropagation()`
  cuando la fila tenga `onRowClick`.

## Sort

- **Cliente** (default): pasa `sortable` + `sortValue` por columna.
- **Servidor**: `sortMode="server"` + `controlledSort` + `onSortChange`.
  Incluir `sortBy`/`sortDir` en el `queryKey` de React Query.

## Paginación

- **Servidor**: usa `pagination` integrada con `useListPageState` y
  `.range()` en Supabase. Resetea a página 0 al cambiar filtros/sort.

## Empty state

- Por defecto renderiza icono + `emptyMessage` + `emptyHint`.
- Para CTA o estado custom usa `emptyState`.

## Casos excepcionales (allowlist)

Las "tablas editables" tipo grid (cotizaciones, conceptos editables) pueden
seguir usando `@/components/ui/table` directamente porque requieren inputs
embebidos por celda. Están listadas explícitamente en
`eslint.config.js` (sección "Allowlist de tablas").

Antes de añadir un nuevo archivo a la allowlist, evalúa primero si encaja en
`DataTable` con un `render` que devuelva controles de formulario.
