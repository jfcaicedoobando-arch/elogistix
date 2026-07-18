import React from "react";
import type { ColumnDef, OnChangeFn, RowSelectionState, VisibilityState } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { Table, TableFooter } from "@/components/ui/table";
import PaginationControls from "@/components/shared/PaginationControls";
import { DataTableHeaderRow } from "@/components/shared/dataTable/DataTableHeaderRow";
import { DataTableBody } from "@/components/shared/dataTable/DataTableBody";
import { useTableInstance } from "@/components/shared/dataTable/useTableInstance";
import { useHorizontalScrollEdges } from "@/components/shared/dataTable/useHorizontalScrollEdges";
import { cn } from "@/lib/utils";
import type {
  DataTablePagination,
  TableDensity,
  SortDir,
} from "@/components/shared/dataTable/types";


// API pública estable: re-exports de tipos/helpers consumidos por todo el proyecto.
// Esta convención (componente + helpers en el mismo archivo) está allowlisted
// en eslint.config.js → react-refresh override, igual que `src/components/ui/**`.
export type { DataTablePagination, TableDensity, ColumnAlign, SortDir } from "@/components/shared/dataTable/types";
export { defineColumns } from "@/components/shared/dataTable/defineColumns";
export type { ColumnDef, VisibilityState } from "@tanstack/react-table";

interface DataTableProps<T> {
  /** API única: `ColumnDef<T, unknown>[]` de TanStack. Construir con
   *  `defineColumns<T>([...])` para autocompletado del `meta` extendido. */
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  /** LucideIcon (recomendado) o ReactNode custom para el empty state built-in. */
  emptyIcon?: React.ReactNode | LucideIcon;
  emptyState?: React.ReactNode;
  skeletonRows?: number;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  /** Si retorna string, la fila navega a esa URL (teclado + Ctrl+click soportados). */
  getRowHref?: (item: T) => string | null;
  /** aria-label opcional para filas navegables. */
  getRowAriaLabel?: (item: T) => string;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
  sortMode?: "client" | "server";
  controlledSort?: { key: string | null; dir: SortDir };
  /** Orden inicial sólo para `sortMode="client"` (default). En server-sort
   *  el orden vive en el page-state y se pasa vía `controlledSort`. */
  initialSort?: { key: string; dir: SortDir };
  onSortChange?: (key: string | null, dir: SortDir) => void;
  density?: TableDensity;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  footer?: React.ReactNode | ((data: T[]) => React.ReactNode);
  pagination?: DataTablePagination;
  className?: string;
  /** Sobrescribe la className del `<table>` interno. Por defecto `"min-w-max"`
   *  (obliga a respetar los anchos de columna declarados). Pásalo como `""`
   *  o `"w-full table-fixed"` cuando no quieras scroll horizontal forzado. */
  tableClassName?: string;
  /** Ancla el encabezado al top del contenedor de scroll (útil en tablas largas). */
  stickyHeader?: boolean;
  /** Visibilidad de columnas controlada (persistida por el caller vía `useColumnVisibility`). */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  /** Selección de filas (v13.286.0). Fuente de verdad: TanStack. El caller
   *  mantiene el estado con `useRowSelection` y pasa aquí `rowSelection` y
   *  `onRowSelectionChange`. Si se omite, la selección queda deshabilitada. */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  enableRowSelection?: boolean;
}

function DataTableInner<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Sin resultados",
  emptyHint,
  emptyIcon,
  emptyState,
  skeletonRows = 5,
  onRowClick,
  onRowMouseEnter,
  getRowHref,
  getRowAriaLabel,
  rowKey,
  rowClassName,
  sortMode = "client",
  controlledSort,
  onSortChange,
  initialSort,
  density = "comfortable",
  striped = true,
  hoverable = true,
  bordered = false,
  footer,
  pagination,
  className,
  tableClassName = "min-w-max",
  stickyHeader = false,
  columnVisibility,
  onColumnVisibilityChange,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection,
}: DataTableProps<T>) {
  const table = useTableInstance<T>({
    data,
    columns,
    sortMode,
    controlledSort,
    onSortChange,
    initialSort,
    getRowId: (row, index) => rowKey(row) ?? String(index),
    columnVisibility,
    onColumnVisibilityChange,
    rowSelection,
    onRowSelectionChange,
    enableRowSelection,
  });

  // Footer recibe el set ya ordenado/visible según TanStack.
  const orderedData = table.getRowModel().rows.map((r) => r.original);
  const renderedFooter =
    typeof footer === "function" ? (footer as (d: T[]) => React.ReactNode)(orderedData) : footer;

  return (
    <div className={className}>
      <div className="relative w-full overflow-x-auto rounded-md [scrollbar-width:thin]">
        {/* v13.139.18 (F-06 auditoría 3): min-w-max obliga a la tabla a
            respetar los anchos declarados por columna; sin él, `w-full` del
            componente `Table` shadcn comprime las columnas y oculta las
            últimas (Estado/ETA) sin activar el scroll horizontal. */}
        <Table className={tableClassName}>
          <DataTableHeaderRow table={table} striped={striped} bordered={bordered} stickyHeader={stickyHeader} />
          <DataTableBody
            table={table}
            isLoading={isLoading}
            skeletonRows={skeletonRows}
            density={density}
            striped={striped}
            hoverable={hoverable}
            bordered={bordered}
            emptyMessage={emptyMessage}
            emptyHint={emptyHint}
            emptyIcon={emptyIcon}
            emptyState={emptyState}
            rowClassName={rowClassName}
            onRowClick={onRowClick}
            onRowMouseEnter={onRowMouseEnter}
            getRowHref={getRowHref}
            getRowAriaLabel={getRowAriaLabel}
          />
          {renderedFooter && !isLoading && orderedData.length > 0 && (
            <TableFooter>{renderedFooter}</TableFooter>
          )}
        </Table>
      </div>
      {pagination && (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={pagination.pageSizeOptions}
          pageSizeLabels={pagination.pageSizeLabels}
        />
      )}
    </div>
  );
}

/**
 * DataTable — tabla genérica del ERP.
 *
 * API única: `ColumnDef<T, unknown>[]` de `@tanstack/react-table` v8.
 * Construir columnas con `defineColumns<T>([...])` para conservar la
 * augmentación de `meta` (`LibreCargaColumnMeta`: width, align, sticky,
 * className, headerClassName).
 *
 * Sort: `sortMode="server"` (default real de los call-sites) delega el
 * orden al RPC vía `controlledSort` + `onSortChange`; `sortMode="client"`
 * usa `getSortedRowModel` de TanStack. En ningún caso debe reaparecer un
 * `useMemo([...data].sort(...))` ni un `useEffect` que rehidrate orden:
 * TanStack es la única fuente de verdad.
 */
export const DataTable = DataTableInner;
