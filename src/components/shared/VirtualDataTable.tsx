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
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import PaginationControls from "@/components/shared/PaginationControls";
import { VirtualRow } from "@/components/shared/VirtualRow";
import {
  ALIGN_CLASS,
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

  // Layout en grid con anchos fijos cuando se proveen; columnas sin width
  // toman 1fr.
  const gridTemplate = columns
    .map((c) => (c.width ? c.width : "minmax(0,1fr)"))
    .join(" ");

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    measureElement:
      typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
        ? (el) => el?.getBoundingClientRect().height ?? estimateRowHeight
        : undefined,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={parentRef}
        className="relative w-full overflow-auto rounded-md border [scrollbar-width:thin]"
        style={{ maxHeight }}
      >
        {/* Header sticky */}
        <div
          className="sticky top-0 z-10 grid bg-muted/60 backdrop-blur-sm text-xs font-medium text-muted-foreground border-b"
          style={{ gridTemplateColumns: gridTemplate }}
          role="row"
        >
          {columns.map((c) => (
            <div
              key={c.key}
              className={cn(
                "px-3 py-2 truncate",
                ALIGN_CLASS[c.align ?? "left"],
                c.headerClassName,
              )}
              role="columnheader"
            >
              {c.header}
            </div>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="grid border-b"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {columns.map((c) => (
                  <div key={c.key} className={cn("px-3", cellPad)}>
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />
            <span>{emptyMessage}</span>
          </div>
        )}

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
