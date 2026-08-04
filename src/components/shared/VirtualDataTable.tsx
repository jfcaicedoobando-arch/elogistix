/**
 * VirtualDataTable — tabla virtualizada para listas largas (cientos/miles
 * de filas). Ensamblador delgado: la maquinaria (instancia + virtualizer +
 * gridTemplate) vive en `useVirtualTableState`, y el contenedor de filas
 * absolutas en `VirtualRowsContainer`. Header / skeleton / empty siguen
 * en `VirtualTableParts`.
 *
 * Úsala cuando el usuario puede paginar a 100+ filas y la altura por fila
 * es variable. Para tablas comunes sigue usando `DataTable`.
 *
 * Contrato de inmutabilidad y renderizado defensivo:
 *   1. `data` DEBE venir ya filtrada/ordenada e inmutable desde el caller
 *      (page-state controllers, `useListPageState`, etc). Este componente
 *      NUNCA dispara mutaciones sobre el estado de filtros globales desde
 *      callbacks de scroll — el scroll es puramente visual.
 *   2. Bajo scroll rápido + cambio simultáneo de `data` (p. ej. el usuario
 *      escribe en el buscador mientras hay inercia de scroll),
 *      `VirtualRowsContainer` filtra defensivamente los `virtualItems` con
 *      índice fuera de rango y el virtualizer usa `getItemKey` por id para
 *      no reciclar mediciones de filas equivocadas. Resultado: las filas
 *      visibles siempre corresponden al snapshot actual de `data`.
 */
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { omitUndefined } from "@/lib/utils/omitUndefined";
import PaginationControls from "@/components/shared/PaginationControls";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { VirtualHeaderRow, SkeletonRows, EmptyState } from "@/components/shared/VirtualTableParts";
import { VirtualRowsContainer } from "@/components/shared/VirtualRowsContainer";
import { useVirtualTableState } from "@/components/shared/dataTable/useVirtualTableState";
import {
  DENSITY_CELL,
  type DataTablePagination,
  type TableDensity,
} from "@/components/shared/dataTable/types";
import type { ColumnDef } from "@tanstack/react-table";

interface VirtualDataTableProps<T> {
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  /** P1-1: pinta error + reintento en lugar de un empty-state engañoso. */
  isError?: boolean;
  onRetry?: () => void;
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

const DEFAULTS = {
  isLoading: false,
  isError: false,
  emptyMessage: "Sin resultados",
  skeletonRows: 8,
  density: "comfortable" as TableDensity,
  striped: true,
  hoverable: true,
  estimateRowHeight: 44,
  maxHeight: 600,
  overscan: 8,
};

function withDefaults<T>(props: VirtualDataTableProps<T>) {
  const cleaned = omitUndefined(props);
  return { ...DEFAULTS, ...cleaned } as VirtualDataTableProps<T> &
    Required<Pick<typeof DEFAULTS, keyof typeof DEFAULTS>>;
}

export function VirtualDataTable<T>(props: VirtualDataTableProps<T>) {
  const {
    columns, data, rowKey, rowClassName, onRowClick, pagination, className,
    isError, onRetry, isLoading, emptyMessage, skeletonRows, density, striped, hoverable,
    estimateRowHeight, maxHeight, overscan,
  } = withDefaults(props);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const cellPad = DENSITY_CELL[density];

  const { table, rows, virtualizer, virtualItems, gridTemplate } =
    useVirtualTableState<T>({
      data,
      columns,
      rowKey,
      parentRef,
      estimateRowHeight,
      overscan,
    });

  const showBody = !isLoading && rows.length > 0;

  if (isError) {
    return (
      <div className={cn("flex flex-col", className)}>
        <ErrorStateInline
          message="No pudimos cargar la información. Revisa tu conexión e intenta de nuevo."
          onRetry={onRetry}
        />
      </div>
    );
  }

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
          <VirtualRowsContainer
            virtualizer={virtualizer}
            virtualItems={virtualItems}
            rows={rows}
            gridTemplate={gridTemplate}
            cellPad={cellPad}
            striped={striped}
            hoverable={hoverable}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
          />
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
