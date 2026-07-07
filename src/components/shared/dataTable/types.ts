export type ColumnAlign = "left" | "right" | "center";
export type TableDensity = "compact" | "comfortable" | "spacious";
export type SortDir = "asc" | "desc";

export interface DataTablePagination {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  pageSizeLabels?: Record<number, string>;
}

export const DENSITY_CELL: Record<TableDensity, string> = {
  compact: "py-1 text-xs",
  comfortable: "py-2",
  spacious: "py-3",
};

/**
 * Altura mínima de fila por densidad. Se aplica al `<TableRow>` durante el
 * estado de loading para que el skeleton reserve exactamente el mismo alto
 * que las filas reales — evita el "salto" cuando llegan los datos.
 */
export const DENSITY_ROW_MIN_H: Record<TableDensity, string> = {
  compact: "h-8",       // 32px
  comfortable: "h-10",  // 40px
  spacious: "h-12",     // 48px
};

export const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};
