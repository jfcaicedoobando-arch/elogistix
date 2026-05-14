import type React from "react";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, DENSITY_CELL, type DataTableColumn, type TableDensity } from "./types";

interface Props<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading: boolean;
  skeletonRows: number;
  density: TableDensity;
  striped: boolean;
  hoverable: boolean;
  bordered: boolean;
  emptyMessage: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  emptyState?: React.ReactNode;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
}

export function DataTableBody<T>({
  columns,
  data,
  isLoading,
  skeletonRows,
  density,
  striped,
  hoverable,
  bordered,
  emptyMessage,
  emptyHint,
  emptyIcon,
  emptyState,
  rowKey,
  rowClassName,
  onRowClick,
  onRowMouseEnter,
}: Props<T>) {
  const cellPad = DENSITY_CELL[density];
  const borderCell = bordered ? "border-r last:border-r-0" : "";
  const icon = emptyIcon ?? <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />;

  if (isLoading) {
    return (
      <TableBody>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <TableRow
            key={`skeleton-${i}`}
            className={cn("hover:bg-transparent", !striped && "even:bg-transparent")}
          >
            {columns.map((col) => (
              <TableCell key={col.key} className={cn(col.width, cellPad, borderCell)}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  if (data.length === 0) {
    return (
      <TableBody>
        <TableRow className="hover:bg-transparent even:bg-transparent">
          <TableCell colSpan={columns.length}>
            {emptyState ?? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                {icon}
                <p className="text-sm font-medium">{emptyMessage}</p>
                {emptyHint && (
                  <p className="text-xs opacity-75 max-w-md text-center">{emptyHint}</p>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  return (
    <TableBody>
      {data.map((item) => (
        <TableRow
          key={rowKey(item)}
          className={cn(
            onRowClick && "cursor-pointer",
            !striped && "even:bg-transparent",
            !hoverable && "hover:bg-transparent",
            rowClassName?.(item),
          )}
          onClick={onRowClick ? () => onRowClick(item) : undefined}
          onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(item) : undefined}
        >
          {columns.map((col) => {
            const align = col.align ?? "left";
            return (
              <TableCell
                key={col.key}
                className={cn(
                  col.width,
                  cellPad,
                  ALIGN_CLASS[align],
                  borderCell,
                  col.className,
                  col.sticky && "sticky left-0 z-[5] bg-background",
                  col.stickyRight && "sticky right-0 z-[5] bg-background shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                )}
              >
                {col.render(item)}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </TableBody>
  );
}
