/**
 * Skeleton del cuerpo de DataTable. Extraído de `DataTableBody.tsx`
 * para mantener cada archivo por debajo del límite Power of 10 (200 líneas).
 *
 * Se alinea 1:1 con las filas reales:
 * - mismo `meta.width`, `align`, `sticky`, `className` que la fila real
 *   → columnas no cambian de ancho ni de alineación al llegar los datos.
 * - `DENSITY_ROW_MIN_H` fija el alto por densidad → cero salto vertical.
 * - anchos de la barra varían por columna con un patrón determinista.
 */
import type { Table } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ALIGN_CLASS, DENSITY_CELL, DENSITY_ROW_MIN_H,
  type ColumnAlign, type TableDensity,
} from "./types";
import "./columnMeta";

const BAR_WIDTHS = ["w-3/5", "w-4/5", "w-2/3", "w-3/4", "w-1/2", "w-5/6"];

interface Props<T> {
  table: Table<T>;
  skeletonRows: number;
  density: TableDensity;
  striped: boolean;
  bordered: boolean;
}

export function DataTableBodySkeleton<T>({
  table, skeletonRows, density, striped, bordered,
}: Props<T>) {
  const leafColumns = table.getAllLeafColumns();
  const cellPad = DENSITY_CELL[density];
  const rowMinH = DENSITY_ROW_MIN_H[density];
  const borderCell = bordered ? "border-r last:border-r-0" : "";
  return (
    <TableBody role="status" aria-busy="true" aria-live="polite">
      <TableRow className="sr-only">
        <TableCell colSpan={leafColumns.length}>Cargando…</TableCell>
      </TableRow>
      {Array.from({ length: skeletonRows }).map((_, i) => (
        <TableRow
          key={`skeleton-${i}`}
          className={cn("hover:bg-transparent", !striped && "even:bg-transparent", rowMinH)}
        >
          {leafColumns.map((col, colIdx) => {
            const meta = col.columnDef.meta ?? {};
            const align: ColumnAlign = meta.align ?? "left";
            const barW = BAR_WIDTHS[(i + colIdx) % BAR_WIDTHS.length];
            const wrapJustify =
              align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
            return (
              <TableCell
                key={col.id}
                className={cn(
                  meta.width, cellPad, ALIGN_CLASS[align], borderCell, meta.className,
                  meta.sticky && "sticky left-0 z-[5] bg-background shadow-[4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                  meta.stickyRight && "sticky right-0 z-[5] bg-background shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]",
                )}
              >
                <div className={cn("flex items-center", wrapJustify)}>
                  <Skeleton className={cn("h-4", barW)} />
                </div>
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </TableBody>
  );
}
