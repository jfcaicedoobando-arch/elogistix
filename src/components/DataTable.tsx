import React from "react";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
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

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead key={col.key} className={col.headerClassName}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : data.length === 0
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
          : data.map((item) => (
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
                  <TableCell key={col.key} className={col.className}>
                    {col.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
