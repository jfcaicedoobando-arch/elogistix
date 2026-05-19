/**
 * Cuerpo de DataTable conectado a la instancia de TanStack Table.
 * Itera `table.getRowModel().rows` (que ya viene ordenado por TanStack en
 * modo client) y delega el render de cada celda a `flexRender`. Sin
 * `useMemo`/`useEffect` ni `.sort()` manual.
 */
import type React from "react";
import { Inbox } from "lucide-react";
import { flexRender, type Table } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, DENSITY_CELL, type ColumnAlign, type TableDensity } from "./types";
import "./columnMeta";

interface Props<T> {
  table: Table<T>;
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
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
}

export function DataTableBody<T>({
  table,
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
  rowClassName,
  onRowClick,
  onRowMouseEnter,
}: Props<T>) {
  const cellPad = DENSITY_CELL[density];
  const borderCell = bordered ? "border-r last:border-r-0" : "";
  const icon = emptyIcon ?? <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />;
  const leafColumns = table.getAllLeafColumns();

  if (isLoading) {
    return (
      <TableBody>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <TableRow
            key={`skeleton-${i}`}
            className={cn("hover:bg-transparent", !striped && "even:bg-transparent")}
          >
            {leafColumns.map((col) => {
              const meta = col.columnDef.meta ?? {};
              return (
                <TableCell key={col.id} className={cn(meta.width, cellPad, borderCell)}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return (
      <TableBody>
        <TableRow className="hover:bg-transparent even:bg-transparent">
          <TableCell colSpan={leafColumns.length}>
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
      {rows.map((row) => {
        const item = row.original;
        return (
          <TableRow
            key={row.id}
            className={cn(
              onRowClick && "cursor-pointer",
              !striped && "even:bg-transparent",
              !hoverable && "hover:bg-transparent",
              rowClassName?.(item),
            )}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(item) : undefined}
          >
            {row.getVisibleCells().map((cell) => {
              const meta = cell.column.columnDef.meta ?? {};
              const align: ColumnAlign = meta.align ?? "left";
              return (
                <TableCell
                  key={cell.id}
                  className={cn(
                    meta.width,
                    cellPad,
                    ALIGN_CLASS[align],
                    borderCell,
                    meta.className,
                    meta.sticky && "sticky left-0 z-[5] bg-background",
                    meta.stickyRight && "sticky right-0 z-[5] bg-background shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              );
            })}
          </TableRow>
        );
      })}
    </TableBody>
  );
}
