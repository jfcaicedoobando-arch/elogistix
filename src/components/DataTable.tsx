import React, { useState, useMemo } from "react";
import { Inbox, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  width?: string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | null;
  sticky?: boolean;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  skeletonRows?: number;
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
}

type SortDir = "asc" | "desc";

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Sin resultados",
  emptyIcon,
  skeletonRows = 5,
  onRowClick,
  rowKey,
  rowClassName,
}: DataTableProps<T>) {
  const icon = emptyIcon ?? <Inbox className="h-10 w-10 text-muted-foreground/40" />;

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortable) return data;

    const extract = col.sortValue;
    if (!extract) return data;

    const sorted = [...data].sort((a, b) => {
      const va = extract(a);
      const vb = extract(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "es-MX", { sensitivity: "base" });
    });

    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir, columns]);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey === colKey) {
      return sortDir === "asc"
        ? <ArrowUp className="h-3 w-3 text-foreground" />
        : <ArrowDown className="h-3 w-3 text-foreground" />;
    }
    return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                col.width,
                col.headerClassName,
                col.sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
              )}
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
            >
              {col.sortable ? (
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  <SortIcon colKey={col.key} />
                </span>
              ) : (
                col.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.width}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : sortedData.length === 0
          ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                    {icon}
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            )
          : sortedData.map((item) => (
              <TableRow
                key={rowKey(item)}
                className={[
                  onRowClick ? "cursor-pointer" : "",
                  rowClassName?.(item) ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn(col.width, col.className)}>
                    {col.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
