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
import { useCallback, useMemo, useRef } from "react";
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

const isFirefox =
  typeof navigator !== "undefined" && navigator.userAgent.indexOf("Firefox") !== -1;

function measureByBoundingRect(el: HTMLElement): number {
  return el?.getBoundingClientRect().height ?? 0;
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

  // getRowId estable: si `rowKey` cambia de identidad por render, TanStack
  // no recrea filas porque el id resultante es el mismo. Pero estabilizamos
  // la función para evitar trabajo extra en useReactTable.
  const getRowId = useCallback(
    (row: T, index: number) => rowKey(row) ?? String(index),
    [rowKey],
  );

  const table = useTableInstance<T>({
    data,
    columns,
    sortMode: "client",
    enableSorting: false,
    getRowId,
  });

  const parentRef = useRef<HTMLDivElement | null>(null);
  const cellPad = DENSITY_CELL[density];
  const rows = table.getRowModel().rows;

  // gridTemplate sólo cambia si cambia el set de columnas o sus widths.
  // Memoizar evita re-string concat por scroll y, sobre todo, mantiene la
  // identidad de la prop para que `React.memo(VirtualRow)` ahorre re-renders.
  const leafColumns = table.getAllLeafColumns();
  const gridTemplate = useMemo(
    () => leafColumns.map((c) => c.columnDef.meta?.width ?? "minmax(0,1fr)").join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leafColumns es la dep real
    [leafColumns.length, leafColumns.map((c) => c.columnDef.meta?.width).join("|")],
  );

  // measureElement debe tener identidad estable: useVirtualizer la lee en
  // cada opción y una función nueva por render dispara trabajo de re-medición
  // (resize observer churn). Firefox tiene bug conocido con sub-pixel sizes,
  // por eso se omite.
  const measureElement = useMemo(
    () => (isFirefox ? undefined : measureByBoundingRect),
    [],
  );

  const estimateSize = useCallback(() => estimateRowHeight, [estimateRowHeight]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    measureElement,
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
