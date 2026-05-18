import { cn } from "@/lib/utils";
import {
  ALIGN_CLASS,
  type DataTableColumn,
} from "@/components/shared/dataTable/types";

interface VirtualRowProps<T> {
  item: T;
  index: number;
  start: number;
  columns: DataTableColumn<T>[];
  cellPad: string;
  gridTemplate: string;
  striped: boolean;
  hoverable: boolean;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  measureRef: (el: HTMLElement | null) => void;
}

export function VirtualRow<T>({
  item, index, start, columns, cellPad, gridTemplate,
  striped, hoverable, onRowClick, rowClassName, measureRef,
}: VirtualRowProps<T>) {
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
      {columns.map((c) => (
        <div
          key={c.key}
          className={cn("px-3 min-w-0", cellPad, ALIGN_CLASS[c.align ?? "left"], c.className)}
          role="cell"
        >
          {c.render(item)}
        </div>
      ))}
    </div>
  );
}
