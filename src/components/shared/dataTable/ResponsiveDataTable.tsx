import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/shared/DataTable";
import PaginationControls from "@/components/shared/PaginationControls";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import { useIsMobile } from "@/hooks/shared";
import { handleRowClick, handleRowKeyDown } from "./rowNav";
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
 * `DataTable`.
 *
 * v13.200.0: `getRowHref` es reconocido tanto en desktop (fila navegable)
 * como en mobile (tarjeta navegable con teclado + Ctrl+click).
 */
interface Props<T> {
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Nodo custom para el empty state (CTA accionable). Si se define, reemplaza `emptyMessage`. */
  emptyState?: ReactNode;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  getRowHref?: (item: T) => string | null;
  getRowAriaLabel?: (item: T) => string;
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
    data, isLoading, emptyMessage = "Sin resultados", emptyState, onRowClick,
    getRowHref, getRowAriaLabel,
    rowKey, mobileCard, pagination, skeletonRows = 5, className,
  } = props;
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <div className={className}>
        <DataTable {...props} />
      </div>
    );
  }

  return (
    <div className={className}>
      <div>
        {isLoading && data.length === 0 ? (
          <SkeletonGroup className="p-3 space-y-2">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </SkeletonGroup>
        ) : data.length === 0 ? (
          emptyState ?? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />
              <span>{emptyMessage}</span>
            </div>
          )
        ) : (
          <ul className="divide-y">
            {data.map((row) => {
              const href = getRowHref?.(row) ?? null;
              const ariaLabel = getRowAriaLabel?.(row);
              if (href) {
                return (
                  <li
                    key={rowKey(row)}
                    role="link"
                    tabIndex={0}
                    aria-label={ariaLabel}
                    onClick={(e) => handleRowClick(e, { href, navigate })}
                    onKeyDown={(e) => handleRowKeyDown(e, { href, navigate })}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        window.open(href, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="min-h-14 px-3 py-2.5 cursor-pointer active:bg-muted/60 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    {mobileCard(row)}
                  </li>
                );
              }
              const clickable = !!onRowClick;
              return (
                <li key={rowKey(row)}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onRowClick?.(row)}
                      className="w-full text-left min-h-14 px-3 py-2.5 active:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:bg-muted/60"
                    >
                      {mobileCard(row)}
                    </button>
                  ) : (
                    <div className="px-3 py-2.5 min-h-14">{mobileCard(row)}</div>
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

