import {
  tableFeatures, rowSortingFeature, columnVisibilityFeature, rowSelectionFeature,
  createSortedRowModel, metaHelper, sortFn_text, sortFn_alphanumeric, sortFn_datetime,
} from "@tanstack/react-table";
import type { LibreCargaColumnMeta } from "./columnMeta";

// Only the features consumed by shared tables. Pagination/filtering stay external.
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
  columnMeta: metaHelper<LibreCargaColumnMeta>(),
});
