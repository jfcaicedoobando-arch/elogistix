import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, type DataTableColumn, type SortDir } from "./types";

interface Props<T> {
  columns: DataTableColumn<T>[];
  striped: boolean;
  bordered: boolean;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
}

export function DataTableHeaderRow<T>({
  columns,
  striped,
  bordered,
  sortKey,
  sortDir,
  onSort,
}: Props<T>) {
  const borderCell = bordered ? "border-r last:border-r-0" : "";

  return (
    <TableHeader>
      <TableRow
        className={cn("hover:bg-transparent", !striped && "even:bg-transparent")}
      >
        {columns.map((col) => {
          const align = col.align ?? "left";
          const isActive = sortKey === col.key;
          return (
            <TableHead
              key={col.key}
              className={cn(
                col.width,
                ALIGN_CLASS[align],
                borderCell,
                col.headerClassName,
                col.sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
                col.sticky && "sticky left-0 z-20 bg-background",
                col.stickyRight && "sticky right-0 z-20 bg-background shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]",
              )}
              onClick={col.sortable ? () => onSort(col.key) : undefined}
            >
              {col.sortable ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    align === "right" && "flex-row-reverse",
                    align === "center" && "justify-center w-full",
                  )}
                >
                  {col.header}
                  {isActive
                    ? (sortDir === "asc"
                        ? <ArrowUp className="h-3 w-3 text-foreground" />
                        : <ArrowDown className="h-3 w-3 text-foreground" />)
                    : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </span>
              ) : (
                col.header
              )}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}
