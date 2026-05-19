/**
 * VirtualDataTable — Tabla virtualizada para listas largas (cientos/miles de filas).
 *
 * Refactor 9.1.0:
 *  - El modelo de filas viene de `@tanstack/react-table` (`useTableInstance`)
 *    para que el orden y la visibilidad sean responsabilidad de TanStack,
 *    no de un `useMemo` paralelo.
 *  - La virtualización (`@tanstack/react-virtual`) se conecta a
 *    `table.getRowModel().rows`, no al array `data` crudo.
 *  - Sin ordenamiento client por default (las virtualizadas suelen venir
 *    pre-ordenadas del servidor); se puede activar pasando `sortMode="client"`
 *    en una próxima iteración.
 *
 * Úsala cuando el usuario puede paginar a 100+ filas y la altura por fila es
 * variable (payloads, notas largas). Para tablas comunes sigue usando `DataTable`.
 */
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import PaginationControls from "@/components/shared/PaginationControls";
import { VirtualRow } from "@/components/shared/VirtualRow";
import { VirtualHeaderRow, SkeletonRows, EmptyState } from "@/components/shared/VirtualTableParts";
import { useTableInstance } from "@/components/shared/dataTable/useTableInstance";
import {
  DENSITY_CELL,
  type DataTableColumn,
  type DataTablePagination,
  type TableDensity,
} from "@/components/shared/dataTable/types";
import type { ColumnDef, Table } from "@tanstack/react-table";

function buildGridTemplate<T>(table: Table<T>): string {
  return table
    .getAllLeafColumns()
    .map((c) => c.columnDef.meta?.width ?? "minmax(0,1fr)")
    .join(" ");
}

function pickMeasureElement(estimateRowHeight: number): ((el: HTMLElement) => number) | undefined {
  if (typeof window === "undefined") return undefined;
  if (navigator.userAgent.indexOf("Firefox") !== -1) return undefined;
  return (el) => el?.getBoundingClientRect().height ?? estimateRowHeight;
}

interface VirtualDataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T> | ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  density?: TableDensity;
  striped?: boolean;
  hoverable?: boolean;
  /** Altura estimada por fila (px). Si las filas tienen alturas variables,
   *  react-virtual la corregirá con measureElement. */
  estimateRowHeight?: number;
  /** Altura máxima del viewport virtualizado (px). */
  maxHeight?: number;
  overscan?: number;
  pagination?: DataTablePagination;
  className?: string;
}

export function VirtualDataTable<T>(props: VirtualDataTableProps<T>) {
  const {
    columns, data, isLoading = false, emptyMessage = "Sin resultados", skeletonRows = 8,
    rowKey, rowClassName, onRowClick, density = "comfortable", striped = true, hoverable = true,
    estimateRowHeight = 44, maxHeight = 600, overscan = 8, pagination, className,
  } = props;

  const table = useTableInstance<T>({
    data,
    columns,
    sortMode: "client",
    enableSorting: false,
    getRowId: (row, index) => rowKey(row) ?? String(index),
  });

  const parentRef = useRef<HTMLDivElement | null>(null);
  const cellPad = DENSITY_CELL[density];
  const gridTemplate = buildGridTemplate(table);
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    measureElement: pickMeasureElement(estimateRowHeight),
  });

  const virtualItems = virtualizer.getVirtualItems();
  const showBody = !isLoading && rows.length > 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={parentRef}
        className="relative w-full overflow-auto rounded-md border [scrollbar-width:thin]"
        style={{ maxHeight }}
      >
        <VirtualHeaderRow table={table} gridTemplate={gridTemplate} />
        {isLoading && (
          <SkeletonRows count={skeletonRows} table={table} gridTemplate={gridTemplate} cellPad={cellPad} />
        )}
        {!isLoading && rows.length === 0 && <EmptyState message={emptyMessage} />}
        {showBody && (
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualItems.map((vi) => (
              <VirtualRow
                key={rows[vi.index].id}
                row={rows[vi.index]}
                index={vi.index}
                start={vi.start}
                cellPad={cellPad}
                gridTemplate={gridTemplate}
                striped={striped}
                hoverable={hoverable}
                onRowClick={onRowClick}
                rowClassName={rowClassName}
                measureRef={virtualizer.measureElement}
              />
            ))}
          </div>
        )}
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
