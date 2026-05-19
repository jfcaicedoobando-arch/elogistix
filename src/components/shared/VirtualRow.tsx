import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { flexRender, type Row } from "@tanstack/react-table";
import { ALIGN_CLASS, type ColumnAlign } from "@/components/shared/dataTable/types";
import "@/components/shared/dataTable/columnMeta";

interface VirtualRowProps<T> {
  row: Row<T>;
  index: number;
  start: number;
  cellPad: string;
  gridTemplate: string;
  striped: boolean;
  hoverable: boolean;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  measureRef: (el: HTMLElement | null) => void;
}

/**
 * Fila individual de `VirtualDataTable`. Recibe una `Row<T>` de TanStack y
 * delega cada celda en `flexRender`. No itera columnas manualmente — el
 * orden y la visibilidad los controla la instancia de tabla.
 *
 * Perf (9.1.3): el componente está envuelto en `React.memo` con comparador
 * superficial sobre las props que realmente afectan el render (row, start,
 * gridTemplate, cellPad, striped, hoverable). Al hacer scroll, el parent
 * re-renderiza con un nuevo `virtualItems`, pero las filas cuyo `start` e
 * `id` no cambiaron NO se re-montan. Para que la memo sea efectiva los
 * callers deben memoizar `onRowClick` y `rowClassName` (se pasan por
 * referencia).
 */
function VirtualRowInner<T>({
  row, index, start, cellPad, gridTemplate,
  striped, hoverable, onRowClick, rowClassName, measureRef,
}: VirtualRowProps<T>) {
  const item = row.original;
  const zebra = striped && index % 2 === 1 ? "bg-muted/30" : "";
  const handleClick = useCallback(() => {
    if (onRowClick) onRowClick(item);
  }, [onRowClick, item]);
  return (
    <div
      ref={measureRef}
      data-index={index}
      role="row"
      className={cn(
        "grid border-b last:border-b-0",
        zebra,
        hoverable && "hover:bg-accent/40",
        onRowClick && "cursor-pointer",
        rowClassName?.(item),
      )}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${start}px)`,
        gridTemplateColumns: gridTemplate,
      }}
      onClick={onRowClick ? handleClick : undefined}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta ?? {};
        const align: ColumnAlign = meta.align ?? "left";
        return (
          <div
            key={cell.id}
            className={cn("px-3 min-w-0", cellPad, ALIGN_CLASS[align], meta.className)}
            role="cell"
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
    </div>
  );
}

function areEqual<T>(prev: VirtualRowProps<T>, next: VirtualRowProps<T>): boolean {
  return (
    prev.row === next.row &&
    prev.index === next.index &&
    prev.start === next.start &&
    prev.cellPad === next.cellPad &&
    prev.gridTemplate === next.gridTemplate &&
    prev.striped === next.striped &&
    prev.hoverable === next.hoverable &&
    prev.onRowClick === next.onRowClick &&
    prev.rowClassName === next.rowClassName &&
    prev.measureRef === next.measureRef
  );
}

// React.memo no preserva genéricos: casteo controlado al tipo público.
export const VirtualRow = memo(VirtualRowInner, areEqual) as <T>(
  props: VirtualRowProps<T>,
) => ReturnType<typeof VirtualRowInner<T>>;
