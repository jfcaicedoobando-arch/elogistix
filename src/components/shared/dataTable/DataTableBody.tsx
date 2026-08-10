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
 *
 * Skeleton y empty state se delegan a componentes dedicados para respetar
 * el límite Power of 10 (≤200 líneas por archivo).
 */
import type React from "react";
import { type LucideIcon } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { useSafeNavigate } from "./useSafeNavigate";
import { TableBody } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DENSITY_CELL, type TableDensity } from "./types";
import { DataTableBodySkeleton } from "./DataTableBodySkeleton";
import { DataTableBodyEmpty } from "./DataTableBodyEmpty";
import { DataTableRow } from "./DataTableRow";
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
  /**
   * Modo selección (v13.490.0): cuando hay al menos una fila seleccionada, el
   * clic en cualquier parte de la fila marca/desmarca en lugar de navegar. Así
   * un clic mal apuntado (fuera del checkbox) no destruye la selección.
   */
  selectionMode?: boolean;
}

export function DataTableBody<T>({
  table, isLoading, skeletonRows, density, striped, hoverable, bordered,
  emptyMessage, emptyHint, emptyIcon, emptyState,
  rowClassName, onRowClick, onRowMouseEnter, getRowHref, getRowAriaLabel,
  selectionMode = false,
}: Props<T>) {

  const navigate = useSafeNavigate();
  const cellPad = DENSITY_CELL[density];
  const borderCell = bordered ? "border-r last:border-r-0" : "";
  const leafColumns = table.getAllLeafColumns();

  if (isLoading) {
    return (
      <DataTableBodySkeleton
        table={table} skeletonRows={skeletonRows} density={density}
        striped={striped} bordered={bordered}
      />
    );
  }

  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return (
      <DataTableBodyEmpty
        colSpan={leafColumns.length}
        emptyMessage={emptyMessage} emptyHint={emptyHint}
        emptyIcon={emptyIcon} emptyState={emptyState}
      />
    );
  }

  return (
    <TableBody>
      {rows.map((row) => (
        <DataTableRow
          key={row.id}
          row={row}
          cellPad={cellPad}
          borderCell={borderCell}
          striped={striped}
          hoverable={hoverable}
          selectionMode={selectionMode}
          navigate={navigate}
          rowClassName={rowClassName}
          onRowClick={onRowClick}
          onRowMouseEnter={onRowMouseEnter}
          getRowHref={getRowHref}
          getRowAriaLabel={getRowAriaLabel}
        />
      ))}
    </TableBody>
  );
}
