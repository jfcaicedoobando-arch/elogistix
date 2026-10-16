/**
 * Encabezado de DataTable conectado a la instancia de TanStack Table.
 * Lee headerGroups → headers y deja a TanStack manejar el toggle de sort
 * (`getToggleSortingHandler()` cicla asc → desc → none). El componente sólo
 * pinta el indicador visual.
 */
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import type { Table } from "@/components/shared/dataTable/tanstackTypes";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, type ColumnAlign } from "./types";
import "./columnMeta";

interface Props<T extends object> {
  table: Table<T>;
  striped: boolean;
  bordered: boolean;
  /** Cuando es true, el encabezado se ancla al top del contenedor de scroll. */
  stickyHeader?: boolean;
}

export function DataTableHeaderRow<T extends object>({ table, striped, bordered, stickyHeader = false }: Props<T>) {
  const borderCell = bordered ? "border-r last:border-r-0" : "";

  return (
    <TableHeader className={cn(stickyHeader && "sticky top-0 z-30 bg-background shadow-[0_1px_0_hsl(var(--border))]")}>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          key={headerGroup.id}
          className={cn("hover:bg-transparent", !striped && "even:bg-transparent", stickyHeader && "bg-background")}
        >
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta ?? {};
            const align: ColumnAlign = meta.align ?? "left";
            const canSort = header.column.getCanSort();
            const sortDir = header.column.getIsSorted(); // false | "asc" | "desc"
            const toggle = header.column.getToggleSortingHandler();
            const ariaSort: "ascending" | "descending" | "none" | undefined = canSort
              ? sortDir === "asc"
                ? "ascending"
                : sortDir === "desc"
                  ? "descending"
                  : "none"
              : undefined;
            return (
              <TableHead
                key={header.id}
                scope="col"
                aria-sort={ariaSort}
                className={cn(
                  meta.width,
                  ALIGN_CLASS[align],
                  borderCell,
                  "whitespace-nowrap",
                  meta.headerClassName,
                  meta.sticky && "sticky left-0 z-20 bg-background shadow-[4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                  meta.stickyRight && "sticky right-0 z-20 bg-background shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                )}
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={toggle}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm p-0 [text-transform:inherit] cursor-pointer select-none hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      align === "right" && "flex-row-reverse",
                      align === "center" && "justify-center w-full",
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortDir === "asc" && <ArrowUp className="h-3 w-3 text-foreground" />}
                    {sortDir === "desc" && <ArrowDown className="h-3 w-3 text-foreground" />}
                    {!sortDir && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </button>
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
