import React from "react";
import { Table, TableFooter } from "@/components/ui/table";
import PaginationControls from "@/components/shared/PaginationControls";
import { DataTableHeaderRow } from "@/components/shared/dataTable/DataTableHeaderRow";
import { DataTableBody } from "@/components/shared/dataTable/DataTableBody";
import { useDataTableSort } from "@/components/shared/dataTable/useDataTableSort";
import type {
  DataTableColumn,
  DataTablePagination,
  TableDensity,
  SortDir,
} from "@/components/shared/dataTable/types";

export type { DataTableColumn, DataTablePagination, TableDensity, ColumnAlign } from "@/components/shared/dataTable/types";

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
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
  const { sortKey, sortDir, handleSort, sortedData } = useDataTableSort({
    data,
    columns,
    sortMode,
    controlledSort,
    onSortChange,
  });

  const renderedFooter =
    typeof footer === "function" ? (footer as (d: T[]) => React.ReactNode)(sortedData) : footer;

  return (
    <div className={className}>
      <div className="relative w-full overflow-x-auto rounded-md [scrollbar-width:thin]">
        <Table>
          <DataTableHeaderRow
            columns={columns}
            striped={striped}
            bordered={bordered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <DataTableBody
            columns={columns}
            data={sortedData}
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
            rowKey={rowKey}
            rowClassName={rowClassName}
            onRowClick={onRowClick}
            onRowMouseEnter={onRowMouseEnter}
          />
          {renderedFooter && !isLoading && sortedData.length > 0 && (
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
 * DataTable — componente genérico de tabla.
 * Refactorizado en sub-componentes: DataTableHeaderRow, DataTableBody y
 * useDataTableSort. Mantiene compatibilidad con la API previa.
 */
export const DataTable = DataTableInner;
