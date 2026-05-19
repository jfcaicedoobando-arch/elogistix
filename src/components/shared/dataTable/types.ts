import type React from "react";

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

// React import preserved for downstream callers that re-export shared types.
export type _ReactKept = React.ReactNode;
