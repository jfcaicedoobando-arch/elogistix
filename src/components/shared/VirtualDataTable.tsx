/**
 * VirtualDataTable — Tabla virtualizada para listas largas (cientos/miles de filas).
 *
 * No usa `<table>` HTML para permitir virtualización con alturas variables
 * (medidas en runtime vía `measureElement`). Reutiliza el contrato
 * `DataTableColumn<T>` del DataTable estándar para compartir columnas.
 *
 * Úsala cuando:
 *  - El usuario puede paginar a 100+ filas y la fila puede expandirse
 *    (payloads, notas largas, etc.).
 *  - No necesitas footer, sticky columns ni ordenamiento client-side.
 *
 * Para tablas comunes (≤50 filas, paginadas, con sort/footer) sigue usando
 * `DataTable`.
 */
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import PaginationControls from "@/components/shared/PaginationControls";
import { VirtualRow } from "@/components/shared/VirtualRow";
import { VirtualHeaderRow, SkeletonRows, EmptyState } from "@/components/shared/VirtualTableParts";
import {
  DENSITY_CELL,
  type DataTableColumn,
  type DataTablePagination,
  type TableDensity,
} from "@/components/shared/dataTable/types";

interface VirtualDataTableProps<T> {
  columns: DataTableColumn<T>[];
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

export function VirtualDataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Sin resultados",
  skeletonRows = 8,
  rowKey,
  rowClassName,
  onRowClick,
  density = "comfortable",
  striped = true,
  hoverable = true,
  estimateRowHeight = 44,
  maxHeight = 600,
  overscan = 8,
  pagination,
  className,
}: VirtualDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const cellPad = DENSITY_CELL[density];
  const gridTemplate = buildGridTemplate(columns);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    measureElement: pickMeasureElement(estimateRowHeight),
  });
  const items = virtualizer.getVirtualItems();

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={parentRef}
        className="relative w-full overflow-auto rounded-md border [scrollbar-width:thin]"
        style={{ maxHeight }}
      >
        <VirtualHeaderRow columns={columns} gridTemplate={gridTemplate} />
        {isLoading && (
          <SkeletonRows count={skeletonRows} columns={columns} gridTemplate={gridTemplate} cellPad={cellPad} />
        )}
        {!isLoading && data.length === 0 && <EmptyState message={emptyMessage} />}

        {/* Filas virtualizadas */}
        {!isLoading && data.length > 0 && (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {items.map((vi) => (
              <VirtualRow
                key={rowKey(data[vi.index])}
                item={data[vi.index]}
                index={vi.index}
                start={vi.start}
                columns={columns}
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
