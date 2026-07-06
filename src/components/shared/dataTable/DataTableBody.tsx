/**
 * Cuerpo de DataTable conectado a la instancia de TanStack Table.
 * Itera `table.getRowModel().rows` (que ya viene ordenado por TanStack en
 * modo client) y delega el render de cada celda a `flexRender`. Sin
 * `useMemo`/`useEffect` ni `.sort()` manual.
 *
 * Drilldown accesible (v13.200.0):
 * - Si `getRowHref(row)` devuelve string, la fila se comporta como link:
 *   role=link, tabIndex=0, teclado (Enter/Space), Ctrl/Cmd+click en pestaña
 *   nueva. Controles internos (botones, checkboxes, dropdowns) se detectan
 *   automáticamente y NO disparan la navegación.
 * - `onRowClick` sigue disponible para tablas que abren un modal en vez de
 *   navegar. `getRowHref` tiene prioridad si ambos están presentes.
 */
import type React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { flexRender, type Table } from "@tanstack/react-table";
import { useInRouterContext, useNavigate, type NavigateFunction } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, DENSITY_CELL, type ColumnAlign, type TableDensity } from "./types";
import { handleRowClick, handleRowKeyDown, isInteractiveDescendant } from "./rowNav";
import { isLucideIcon } from "./isLucideIcon";
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
  emptyIcon?: React.ReactNode | LucideIcon;
  emptyState?: React.ReactNode;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  /** Si retorna string, la fila navega a esa URL con soporte de teclado y Ctrl+click. */
  getRowHref?: (item: T) => string | null;
  /** aria-label opcional para filas navegables. */
  getRowAriaLabel?: (item: T) => string;
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
  getRowHref,
  getRowAriaLabel,
}: Props<T>) {
  const inRouter = useInRouterContext();
  // useNavigate se llama incondicionalmente si hay router. Cuando no lo hay
  // (tests unitarios directos), usamos un fallback no-op para que la tabla
  // siga renderizando sin acoplar los tests a MemoryRouter.
  const navigate: NavigateFunction = inRouter ? useNavigate() : (() => {}) as NavigateFunction;
  const cellPad = DENSITY_CELL[density];
  const borderCell = bordered ? "border-r last:border-r-0" : "";
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
    // Empty state homologado: `emptyState` slot sólo se usa cuando el caller
    // quiere un `<EmptyState>` grande con CTA (páginas de bandeja, tabs de
    // embarque). El default renderiza `EmptyStateInline` — misma fuente
    // visual que cards/paneles → toda la app se ve idéntica.
    const iconComponent = isLucideIcon(emptyIcon) ? emptyIcon : undefined;
    const iconNode = !isLucideIcon(emptyIcon) ? emptyIcon : undefined;
    return (
      <TableBody>
        <TableRow className="hover:bg-transparent even:bg-transparent">
          <TableCell colSpan={leafColumns.length} className="p-0">
            {emptyState ?? (
              iconNode ? (
                <div className="flex flex-col items-center justify-center gap-2 text-center py-10 px-4 text-muted-foreground">
                  {iconNode}
                  <p className="text-sm">{emptyMessage}</p>
                  {emptyHint && <p className="text-xs opacity-75 max-w-xs">{emptyHint}</p>}
                </div>
              ) : (
                <EmptyStateInline
                  icon={iconComponent ?? Inbox}
                  message={emptyMessage}
                  hint={emptyHint}
                  className="py-10"
                />
              )
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
        const href = getRowHref?.(item) ?? null;
        const navigable = !!href;
        const clickable = navigable || !!onRowClick;
        return (
          <TableRow
            key={row.id}
            className={cn(
              clickable && "cursor-pointer",
              navigable && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              !striped && "even:bg-transparent",
              !hoverable && "hover:bg-transparent",
              rowClassName?.(item),
            )}
            role={navigable ? "link" : undefined}
            tabIndex={navigable ? 0 : undefined}
            aria-label={navigable ? getRowAriaLabel?.(item) : undefined}
            onClick={(e) => {
              if (navigable && href) {
                handleRowClick(e, { href, navigate });
                if (e.defaultPrevented) return;
              }
              if (onRowClick && !isInteractiveDescendant(e.target)) onRowClick(item);
            }}
            onKeyDown={(e) => {
              if (navigable && href) handleRowKeyDown(e, { href, navigate });
            }}
            onAuxClick={(e) => {
              if (navigable && href && e.button === 1) {
                e.preventDefault();
                window.open(href, "_blank", "noopener,noreferrer");
              }
            }}
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
                    meta.sticky && "sticky left-0 z-[5] bg-background shadow-[4px_0_4px_-2px_hsl(var(--border)/0.3)]",
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
