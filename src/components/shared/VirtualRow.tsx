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
 */
export function VirtualRow<T>({
  row, index, start, cellPad, gridTemplate,
  striped, hoverable, onRowClick, rowClassName, measureRef,
}: VirtualRowProps<T>) {
  const item = row.original;
  const zebra = striped && index % 2 === 1 ? "bg-muted/30" : "";
  const handleClick = onRowClick ? () => onRowClick(item) : undefined;
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
      onClick={handleClick}
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
