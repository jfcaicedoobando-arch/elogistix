/**
 * Una fila de `DataTableBody`. Se extrajo del cuerpo de la tabla para respetar
 * el límite de complejidad ciclomática (ESLint 16) y mantener el body legible.
 */
import { flexRender, type Cell, type Row } from "@tanstack/react-table";
import type { NavigateFunction } from "react-router-dom";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, type ColumnAlign } from "./types";
import {
  buildRowAuxClickHandler,
  buildRowClickHandler,
  buildRowKeyDownHandler,
  type RowBehavior,
} from "./rowHandlers";
import "./columnMeta";

const STICKY_LEFT =
  "sticky left-0 z-sticky bg-background [tr:nth-child(even)_&]:bg-muted/45 dark:[tr:nth-child(even)_&]:bg-muted/30 [tr:hover_&]:bg-primary/5 [tr[data-state=selected]_&]:bg-muted shadow-[4px_0_4px_-2px_hsl(var(--border)/0.3)]";
const STICKY_RIGHT =
  "sticky right-0 z-sticky bg-background [tr:nth-child(even)_&]:bg-muted/45 dark:[tr:nth-child(even)_&]:bg-muted/30 [tr:hover_&]:bg-primary/5 [tr[data-state=selected]_&]:bg-muted shadow-[-4px_0_4px_-2px_hsl(var(--border)/0.3)]";

interface Props<T> {
  row: Row<T>;
  cellPad: string;
  borderCell: string;
  striped: boolean;
  hoverable: boolean;
  selectionMode: boolean;
  navigate: NavigateFunction;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  getRowHref?: (item: T) => string | null;
  getRowAriaLabel?: (item: T) => string;
}

export function DataTableRow<T>({
  row, cellPad, borderCell, striped, hoverable, selectionMode, navigate,
  rowClassName, onRowClick, onRowMouseEnter, getRowHref, getRowAriaLabel,
}: Props<T>) {
  const item = row.original;
  const seleccionable = selectionMode && row.getCanSelect();
  const href = seleccionable ? null : (getRowHref?.(item) ?? null);
  const navigable = !!href;
  const clickable = navigable || !!onRowClick || seleccionable;

  const behavior: RowBehavior<T> = {
    item, href, seleccionable, navigable, navigate, onRowClick,
    toggleSelected: () => row.toggleSelected(!row.getIsSelected()),
  };

  return (
    <TableRow
      className={cn(rowClasses({ clickable, navigable, seleccionable, striped, hoverable }), rowClassName?.(item))}
      role={navigable ? "link" : undefined}
      tabIndex={navigable || seleccionable ? 0 : undefined}
      aria-selected={seleccionable ? row.getIsSelected() : undefined}
      aria-label={navigable ? getRowAriaLabel?.(item) : undefined}
      onClick={buildRowClickHandler(behavior)}
      onKeyDown={buildRowKeyDownHandler(behavior)}
      onAuxClick={buildRowAuxClickHandler(behavior)}
      onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(item) : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <DataTableCell key={cell.id} cell={cell} cellPad={cellPad} borderCell={borderCell} />
      ))}
    </TableRow>
  );
}

interface RowClassArgs {
  clickable: boolean;
  navigable: boolean;
  seleccionable: boolean;
  striped: boolean;
  hoverable: boolean;
}

function rowClasses({ clickable, navigable, seleccionable, striped, hoverable }: RowClassArgs) {
  return cn(
    clickable && "cursor-pointer",
    (navigable || seleccionable)
      && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    !striped && "even:bg-transparent",
    !hoverable && "hover:bg-transparent",
  );
}

function DataTableCell<T>({
  cell, cellPad, borderCell,
}: {
  cell: Cell<T, unknown>;
  cellPad: string;
  borderCell: string;
}) {
  const meta = cell.column.columnDef.meta ?? {};
  const align: ColumnAlign = meta.align ?? "left";
  return (
    <TableCell
      className={cn(
        meta.width, cellPad, ALIGN_CLASS[align], borderCell, meta.className,
        meta.sticky && STICKY_LEFT,
        meta.stickyRight && STICKY_RIGHT,
      )}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}
