import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Table, TableFooter } from "@/components/ui/table";
import PaginationControls from "@/components/shared/PaginationControls";
import { DataTableHeaderRow } from "@/components/shared/dataTable/DataTableHeaderRow";
import { DataTableBody } from "@/components/shared/dataTable/DataTableBody";
import { useTableInstance } from "@/components/shared/dataTable/useTableInstance";
import type {
  DataTableColumn,
  DataTablePagination,
  TableDensity,
  SortDir,
} from "@/components/shared/dataTable/types";

export type { DataTableColumn, DataTablePagination, TableDensity, ColumnAlign, SortDir } from "@/components/shared/dataTable/types";
export { defineColumns } from "@/components/shared/dataTable/defineColumns";
export type { ColumnDef } from "@tanstack/react-table";

interface DataTableProps<T> {
  /** Acepta la API legacy (`DataTableColumn<T>[]`) o `ColumnDef<T>[]` nativo
   *  de TanStack. El motor convierte la primera vía `columnAdapter`. */
  columns: ReadonlyArray<DataTableColumn<T> | ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  emptyState?: React.ReactNode;
  skeletonRows?: number;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
  sortMode?: "client" | "server";
  controlledSort?: { key: string | null; dir: SortDir };
  onSortChange?: (key: string | null, dir: SortDir) => void;
  density?: TableDensity;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  footer?: React.ReactNode | ((data: T[]) => React.ReactNode);
  pagination?: DataTablePagination;
  className?: string;
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
  rowKey,
  rowClassName,
  sortMode = "client",
  controlledSort,
  onSortChange,
  density = "comfortable",
  striped = true,
  hoverable = true,
  bordered = false,
  footer,
  pagination,
  className,
}: DataTableProps<T>) {
  const table = useTableInstance<T>({
    data,
    columns,
    sortMode,
    controlledSort,
    onSortChange,
    getRowId: (row, index) => rowKey(row) ?? String(index),
  });

  // Footer recibe el set ya ordenado/visible según TanStack.
  const orderedData = table.getRowModel().rows.map((r) => r.original);
  const renderedFooter =
    typeof footer === "function" ? (footer as (d: T[]) => React.ReactNode)(orderedData) : footer;

  return (
    <div className={className}>
      <div className="relative w-full overflow-x-auto rounded-md [scrollbar-width:thin]">
        <Table>
          <DataTableHeaderRow table={table} striped={striped} bordered={bordered} />
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
        />
      )}
    </div>
  );
}

/**
 * DataTable — tabla genérica del ERP.
 *
 * Refactor 9.1.0: el motor interno corre 100% sobre `@tanstack/react-table`.
 * La API pública (`DataTableColumn<T>`, `controlledSort`, `sortMode`, etc.)
 * sigue intacta vía adapter para no romper los ~40 call-sites legacy. Para
 * código nuevo, pasar `ColumnDef<T>[]` directo (usar `defineColumns`).
 *
 * Sin `useDataTableSort`, sin `useMemo` que ordena arreglos, sin `useEffect`
 * que sincronice estados paralelos.
 */
export const DataTable = DataTableInner;
