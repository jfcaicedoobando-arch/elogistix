/**
 * Contrato visual compartido para tablas de detalle "crudas" (sin
 * TanStack/DataTable): desgloses de conceptos, estados de cuenta, P&L,
 * dimensiones editables, catálogos, etc.
 *
 * Estandariza:
 *  - Encabezado: mayúsculas suaves + `text-muted-foreground` (mismo look
 *    que `DataTable`).
 *  - Fila: hover `hover:bg-muted/50` consistente (independiente del hover
 *    por defecto de `ui/table.tsx`).
 *  - Densidad: `compact` | `comfortable` (mismo mapeo que `DataTable`).
 *  - Estado vacío: mensaje centrado, muted, alto consistente.
 *
 * No reemplaza a `DataTable` (que sigue siendo la opción por defecto para
 * listados paginados/ordenables). Este helper es para tablas de detalle
 * con markup propio (grupos, subtotales, filas editables, colspans, etc.).
 */
import type React from "react";
import { TableHead, TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DetailTableDensity = "compact" | "comfortable";

/** Padding de celda por densidad — mismo mapeo que `dataTable/types.ts`. */
export const DETAIL_TABLE_CELL_PADDING: Record<DetailTableDensity, string> = {
  compact: "py-1 text-xs",
  comfortable: "py-2",
};

/** Alto mínimo del renglón de estado vacío por densidad. */
const DETAIL_TABLE_EMPTY_MIN_H: Record<DetailTableDensity, string> = {
  compact: "h-24",
  comfortable: "h-32",
};

/** Encabezado de columna: mayúsculas suaves + muted, igual que `DataTable`. */
export function DetailTableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <TableHead
      className={cn("text-table-head font-semibold uppercase tracking-wider text-muted-foreground", className)}
      {...props}
    />
  );
}

interface DetailTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Desactiva el hover (p. ej. filas de subtotal ya resaltadas). */
  hoverable?: boolean;
}

/** Fila de detalle con hover consistente en toda la app. */
export function DetailTableRow({ className, hoverable = true, ...props }: DetailTableRowProps) {
  return (
    <TableRow
      className={cn(hoverable ? "hover:bg-muted/50" : "hover:bg-transparent", className)}
      {...props}
    />
  );
}

interface DetailTableEmptyProps {
  colSpan: number;
  message: string;
  density?: DetailTableDensity;
  className?: string;
}

/** Renglón de "sin registros": centrado, muted, mismo alto en toda la app. */
export function DetailTableEmptyRow({
  colSpan,
  message,
  density = "comfortable",
  className,
}: DetailTableEmptyProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <div
          className={cn(
            "flex items-center justify-center text-center text-sm text-muted-foreground",
            DETAIL_TABLE_EMPTY_MIN_H[density],
            className,
          )}
        >
          {message}
        </div>
      </TableCell>
    </TableRow>
  );
}
