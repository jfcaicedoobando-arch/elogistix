import React from "react";
import type { ColumnDef, OnChangeFn, RowSelectionState, VisibilityState } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import PaginationControls from "@/components/shared/PaginationControls";
import { DataTableContent } from "@/components/shared/dataTable/DataTableContent";
import { useTableInstance } from "@/components/shared/dataTable/useTableInstance";
import type { DataTablePagination, TableDensity, SortDir } from "@/components/shared/dataTable/types";

// API pública estable (componente + helpers) — allowlisted en eslint react-refresh override.
export type {    SortDir } from "@/components/shared/dataTable/types";
export { defineColumns } from "@/components/shared/dataTable/defineColumns";
export type { ColumnDef, VisibilityState } from "@tanstack/react-table";


interface DataTableProps<T> {
  /** API única: `ColumnDef<T, unknown>[]` de TanStack. Construir con
   *  `defineColumns<T>([...])` para autocompletado del `meta` extendido. */
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  /** v13.303.75 · Rama de error: cuando la query falla, mostramos un
   *  bloque compacto con "Reintentar" en lugar del empty-state ("Sin
   *  resultados") que confunde al usuario con una carga fallida. */
  isError?: boolean;
  onRetry?: () => void;
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

const DATA_TABLE_DEFAULTS = {
  isLoading: false,
  isError: false,
  emptyMessage: "Sin resultados",
  skeletonRows: 5,
  sortMode: "client" as const,
  density: "comfortable" as TableDensity,
  striped: true,
  hoverable: true,
  bordered: false,
  tableClassName: "min-w-max",
  stickyHeader: false,
};

function mergeDataTableProps<T>(raw: DataTableProps<T>) {
  const merged: Record<string, unknown> = { ...DATA_TABLE_DEFAULTS };
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) merged[k] = v;
  }
  // SAFE-CAST: merge de defaults con props tipadas; el shape resultante es compatible por construcción.
  return merged as unknown as DataTableProps<T> & typeof DATA_TABLE_DEFAULTS;
}

function DataTableInner<T>(rawProps: DataTableProps<T>) {
  const {
    columns, data, onRetry, emptyHint, emptyIcon, emptyState,
    onRowClick, onRowMouseEnter, getRowHref, getRowAriaLabel,
    rowKey, rowClassName, controlledSort, onSortChange, initialSort,
    footer, pagination, className, columnVisibility, onColumnVisibilityChange,
    rowSelection, onRowSelectionChange, enableRowSelection,
    isLoading, isError, emptyMessage, skeletonRows, sortMode, density,
    striped, hoverable, bordered, tableClassName, stickyHeader,
  } = mergeDataTableProps(rawProps);



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
  const showFooter = Boolean(renderedFooter) && !isLoading && orderedData.length > 0;

  return (
    <div className={className}>
      {isError ? (
        <ErrorStateInline
          message="No pudimos cargar la información. Revisa tu conexión e intenta de nuevo."
          onRetry={onRetry}
        />
      ) : (
        <DataTableContent
          table={table}
          tableClassName={tableClassName}
          striped={striped}
          bordered={bordered}
          hoverable={hoverable}
          stickyHeader={stickyHeader}
          density={density}
          isLoading={isLoading}
          skeletonRows={skeletonRows}
          emptyMessage={emptyMessage}
          emptyHint={emptyHint}
          emptyIcon={emptyIcon}
          emptyState={emptyState}
          rowClassName={rowClassName}
          onRowClick={onRowClick}
          onRowMouseEnter={onRowMouseEnter}
          getRowHref={getRowHref}
          getRowAriaLabel={getRowAriaLabel}
          renderedFooter={renderedFooter}
          showFooter={showFooter}
        />
      )}

      {!isError && pagination && (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={pagination.pageSizeOptions}
          pageSizeLabels={pagination.pageSizeLabels}
          total={pagination.total}
        />
      )}
    </div>
  );
}


/**
 * DataTable — tabla genérica del ERP. API única: `ColumnDef<T, unknown>[]`.
 * Construir con `defineColumns<T>([...])` para conservar `meta` extendido.
 * Sort: `sortMode="server"` delega al RPC vía `controlledSort`+`onSortChange`.
 */
export const DataTable = DataTableInner;
