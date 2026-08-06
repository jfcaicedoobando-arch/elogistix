import { cn } from "@/lib/utils";
import { type Row } from "@tanstack/react-table";
import { type ColumnAlign } from "./VirtualDataTable";

interface VirtualRowProps<T> {
  row: Row<T>;
  index: number;
  start: number;
  gridTemplate: string;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  zebra?: string;
  hoverable?: boolean;
}

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function VirtualRow<T>({
  row,
  index,
  start,
  gridTemplate,
  onRowClick,
  rowClassName,
  zebra,
  hoverable,
}: VirtualRowProps<T>) {
  const item = row.original;
  const cellPad = "py-3";

  const handleClick = () => {
    onRowClick?.(item);
  };

  return (
    <div
      data-index={index}
      role="row"
      className={cn(
        "absolute top-0 left-0 w-full grid border-b last:border-b-0",
        zebra,
        hoverable && "hover:bg-accent/40",
        onRowClick && "cursor-pointer",
        rowClassName?.(item),
      )}
      style={{
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
          >
            {row.getVisibleCells().find((c) => c.id === cell.id)?.renderValue() as React.ReactNode}
          </div>
        );
      })}
    </div>
  );
}
