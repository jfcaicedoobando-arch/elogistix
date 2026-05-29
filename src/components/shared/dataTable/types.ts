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

export const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};
