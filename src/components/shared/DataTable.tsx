import React, { useState, useMemo } from "react";
import { Inbox, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import PaginationControls from "@/components/shared/PaginationControls";

export type ColumnAlign = "left" | "right" | "center";
export type TableDensity = "compact" | "comfortable" | "spacious";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  width?: string;
  align?: ColumnAlign;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | null;
  sticky?: boolean;
  stickyRight?: boolean;
  render: (item: T) => React.ReactNode;
}

type SortDir = "asc" | "desc";

export interface DataTablePagination {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  /** Slot custom (CTA, etc.) que reemplaza al empty state por defecto */
  emptyState?: React.ReactNode;
  skeletonRows?: number;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
  /**
   * Modo de ordenamiento. 'client' (default) ordena en memoria sobre `data`.
   * 'server' delega: NO se ordena en memoria, sólo se notifica vía
   * onSortChange para que el padre re-fetche.
   */
  sortMode?: "client" | "server";
  /** Sólo aplica en sortMode='server'. Estado controlado del header activo. */
  controlledSort?: { key: string | null; dir: SortDir };
  /** Sólo aplica en sortMode='server'. Ciclo: null → asc → desc → null. */
  onSortChange?: (key: string | null, dir: SortDir) => void;

  // ===== Fase 1: estandarización visual =====
  /** Densidad de filas. Default 'comfortable'. */
  density?: TableDensity;
  /** Filas alternadas (zebra). Default true. */
  striped?: boolean;
  /** Hover en filas. Default true. */
  hoverable?: boolean;
  /** Bordes verticales entre celdas. Default false. */
  bordered?: boolean;
  /** Footer opcional (ReactNode o función con data filtrada). */
  footer?: React.ReactNode | ((data: T[]) => React.ReactNode);
  /** Paginación integrada opcional (renderiza PaginationControls debajo). */
  pagination?: DataTablePagination;
  /** className raíz del wrapper. */
  className?: string;
}

const DENSITY_CELL: Record<TableDensity, string> = {
  compact: "py-1 text-xs",
  comfortable: "py-2",
  spacious: "py-3",
};

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function DataTableInner<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Sin resultados",
  emptyHint,
  emptyIcon,
  emptyState,
  skeletonRows = 5,
  onRowClick,
  onRowMouseEnter,
  rowKey,
  rowClassName,
  sortMode = "client",
  controlledSort,
  onSortChange,
  density = "comfortable",
  striped = true,
  hoverable = true,
  bordered = false,
  footer,
  pagination,
  className,
}: DataTableProps<T>) {
  const icon = emptyIcon ?? <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />;

  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<SortDir>("asc");

  const isServer = sortMode === "server";
  const sortKey = isServer ? (controlledSort?.key ?? null) : internalSortKey;
  const sortDir = isServer ? (controlledSort?.dir ?? "asc") : internalSortDir;

  const handleSort = (key: string) => {
    let nextKey: string | null;
    let nextDir: SortDir;
    if (sortKey === key) {
      if (sortDir === "asc") {
        nextKey = key;
        nextDir = "desc";
      } else {
        nextKey = null;
        nextDir = "asc";
      }
    } else {
      nextKey = key;
      nextDir = "asc";
    }
    if (isServer) {
      onSortChange?.(nextKey, nextDir);
    } else {
      setInternalSortKey(nextKey);
      setInternalSortDir(nextDir);
    }
  };

  const sortedData = useMemo(() => {
    if (isServer) return data;
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
  }, [data, sortKey, sortDir, columns, isServer]);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey === colKey) {
      return sortDir === "asc"
        ? <ArrowUp className="h-3 w-3 text-foreground" />
        : <ArrowDown className="h-3 w-3 text-foreground" />;
    }
    return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  };

  const cellPad = DENSITY_CELL[density];
  const borderCell = bordered ? "border-r last:border-r-0" : "";

  const renderedFooter =
    typeof footer === "function" ? (footer as (d: T[]) => React.ReactNode)(sortedData) : footer;

  return (
    <div className={className}>
      <div className="relative w-full overflow-x-auto rounded-md [scrollbar-width:thin]">
        <Table>
        <TableHeader>
          <TableRow
            className={cn(
              "hover:bg-transparent",
              !striped && "even:bg-transparent",
            )}
          >
            {columns.map((col) => {
              const align = col.align ?? "left";
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
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
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
                      <SortIcon colKey={col.key} />
                    </span>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className={cn(
                    "hover:bg-transparent",
                    !striped && "even:bg-transparent",
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.width, cellPad, borderCell)}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : sortedData.length === 0
            ? (
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
              )
            : sortedData.map((item) => (
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
        {renderedFooter && !isLoading && sortedData.length > 0 && (
          <TableFooter>{renderedFooter}</TableFooter>
        )}
        </Table>
      </div>
      {pagination && (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={pagination.pageSizeOptions}
        />
      )}
    </div>
  );
}

/**
 * DataTable — componente genérico de tabla.
 *
 * Fase 1 estandarización: añade props opcionales `density`, `striped`,
 * `hoverable`, `bordered`, `align` por columna, `footer`, y `pagination`
 * integrada. Todo retro-compatible.
 *
 * Nota: previamente envolvíamos esto con `memo()`, pero al ser un componente
 * genérico React emitía el warning "Function components cannot be given refs".
 * La memoización efectiva se logra ahora memoizando `columns` y `data` en los
 * padres (useMemo).
 */
export const DataTable = DataTableInner;
