/**
 * Encabezado de DataTable conectado a la instancia de TanStack Table.
 * Lee headerGroups → headers y deja a TanStack manejar el toggle de sort
 * (`getToggleSortingHandler()` cicla asc → desc → none). El componente sólo
 * pinta el indicador visual.
 */
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { flexRender, type Table } from "@tanstack/react-table";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, type ColumnAlign } from "./types";
import "./columnMeta";

interface Props<T> {
  table: Table<T>;
  striped: boolean;
  bordered: boolean;
}

export function DataTableHeaderRow<T>({ table, striped, bordered }: Props<T>) {
  const borderCell = bordered ? "border-r last:border-r-0" : "";

  return (
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          key={headerGroup.id}
          className={cn("hover:bg-transparent", !striped && "even:bg-transparent")}
        >
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta ?? {};
            const align: ColumnAlign = meta.align ?? "left";
            const canSort = header.column.getCanSort();
            const sortDir = header.column.getIsSorted(); // false | "asc" | "desc"
            const toggle = header.column.getToggleSortingHandler();
            return (
              <TableHead
                key={header.id}
                className={cn(
                  meta.width,
                  ALIGN_CLASS[align],
                  borderCell,
                  meta.headerClassName,
                  canSort && "cursor-pointer select-none hover:text-foreground transition-colors",
                  meta.sticky && "sticky left-0 z-20 bg-background",
                  meta.stickyRight && "sticky right-0 z-20 bg-background shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                )}
                onClick={canSort ? toggle : undefined}
              >
                {canSort ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      align === "right" && "flex-row-reverse",
                      align === "center" && "justify-center w-full",
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortDir === "asc" && <ArrowUp className="h-3 w-3 text-foreground" />}
                    {sortDir === "desc" && <ArrowDown className="h-3 w-3 text-foreground" />}
                    {!sortDir && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </span>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );
}
