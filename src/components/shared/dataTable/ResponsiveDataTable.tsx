import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import PaginationControls from "@/components/shared/PaginationControls";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import type {
  DataTablePagination,
  TableDensity,
  SortDir,
} from "@/components/shared/dataTable/types";

/**
 * ResponsiveDataTable — wrapper sobre DataTable.
 *
 * En pantallas `<sm` (móvil 20:9 / iPhone) renderiza una lista de tarjetas
 * táctiles construidas con `mobileCard(row)`. En `≥sm` delega 100% en
 * `DataTable`. La paginación se renderiza una sola vez en cada vista
 * (DataTable en desktop, PaginationControls en móvil) para evitar duplicados.
 *
 * Sin lógica de negocio: sólo presentación. No usa media queries en JS,
 * todo se resuelve con clases Tailwind responsive.
 */
interface Props<T> {
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  rowKey: (item: T) => string;
  rowClassName?: (item: T) => string;
  sortMode?: "client" | "server";
  controlledSort?: { key: string | null; dir: SortDir };
  onSortChange?: (key: string | null, dir: SortDir) => void;
  density?: TableDensity;
  pagination?: DataTablePagination;
  className?: string;
  /** Render de tarjeta móvil. Devuelve el contenido interno; el wrapper aplica tap target y borde. */
  mobileCard: (row: T) => ReactNode;
  skeletonRows?: number;
}

export function ResponsiveDataTable<T>(props: Props<T>) {
  const {
    data, isLoading, emptyMessage = "Sin resultados", onRowClick,
    rowKey, mobileCard, pagination, skeletonRows = 5, className,
  } = props;

  return (
    <div className={className}>
      {/* Desktop / tablet */}
      <div className="hidden sm:block">
        <DataTable {...props} />
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden">
        {isLoading && data.length === 0 ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />
            <span>{emptyMessage}</span>
          </div>
        ) : (
          <ul className="divide-y">
            {data.map((row) => {
              const clickable = !!onRowClick;
              return (
                <li key={rowKey(row)}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onRowClick?.(row)}
                      className="w-full text-left min-h-[56px] px-3 py-2.5 active:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:bg-muted/60"
                    >
                      {mobileCard(row)}
                    </button>
                  ) : (
                    <div className="px-3 py-2.5 min-h-[56px]">{mobileCard(row)}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {pagination && (
          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            pageSize={pagination.pageSize}
            onPageSizeChange={pagination.onPageSizeChange}
            pageSizeOptions={pagination.pageSizeOptions}
            pageSizeLabels={pagination.pageSizeLabels}
          />
        )}
      </div>
    </div>
  );
}
