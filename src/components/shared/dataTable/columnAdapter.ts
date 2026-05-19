/**
 * Adapter de columnas legacy `DataTableColumn<T>` → `ColumnDef<T>` nativo de
 * TanStack Table. Permite que los ~40 call-sites actuales sigan funcionando
 * sin tocar nada mientras el motor interno corre 100% sobre TanStack.
 *
 * Convenciones:
 *  - `key` → `id` y, si la columna tiene `sortValue`, también `accessorFn`
 *    para que `getSortedRowModel` pueda ordenar (modo client) sin que el
 *    caller escriba un comparador.
 *  - `render` → `cell({ row }) => col.render(row.original)`.
 *  - Estilos visuales (`width`, `align`, `className`, `headerClassName`,
 *    `sticky*`) se guardan en `meta` para que header y body los lean.
 *  - `sortable` → `enableSorting` (default `false` cuando no se pide).
 */
import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import type { DataTableColumn } from "./types";
import "./columnMeta";

function makeSortingFn<T>(extract: (item: T) => string | number | null): SortingFn<T> {
  return (a, b) => {
    const va = extract(a.original);
    const vb = extract(b.original);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb), "es-MX", { sensitivity: "base" });
  };
}

export function legacyToColumnDef<T>(col: DataTableColumn<T>): ColumnDef<T, unknown> {
  const sortable = !!col.sortable;
  const extract = col.sortValue;
  const def: ColumnDef<T, unknown> = {
    id: col.key,
    header: col.header,
    enableSorting: sortable,
    cell: ({ row }) => col.render(row.original),
    meta: {
      className: col.className,
      headerClassName: col.headerClassName,
      width: col.width,
      align: col.align,
      sticky: col.sticky,
      stickyRight: col.stickyRight,
    },
  };
  if (sortable && extract) {
    def.accessorFn = (row) => extract(row);
    def.sortingFn = makeSortingFn(extract);
  }
  return def;
}

/**
 * Heurística para detectar si un arreglo viene en forma legacy (con `render`)
 * o ya es `ColumnDef<T>` nativo. Permite que `DataTable` acepte ambos.
 */
export function isLegacyColumns<T>(
  cols: ReadonlyArray<DataTableColumn<T> | ColumnDef<T, unknown>>,
): cols is DataTableColumn<T>[] {
  return cols.length > 0 && "render" in cols[0];
}

export function toColumnDefs<T>(
  cols: ReadonlyArray<DataTableColumn<T> | ColumnDef<T, unknown>>,
): ColumnDef<T, unknown>[] {
  if (cols.length === 0) return [];
  return isLegacyColumns(cols) ? cols.map((c) => legacyToColumnDef(c)) : (cols as ColumnDef<T, unknown>[]);
}
