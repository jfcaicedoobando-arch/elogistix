import type {
  ColumnDef as NativeColumnDef, Table as NativeTable, Row as NativeRow,
  Cell as NativeCell, SortFn as NativeSortFn, TableOptions as NativeTableOptions,
  ColumnVisibilityState,
} from "@tanstack/react-table";
import type { dataTableFeatures } from "./tableFeatures";

type Features = typeof dataTableFeatures;
export type ColumnDef<T extends object, V = unknown> = NativeColumnDef<Features, T, V>;
export type Table<T extends object> = NativeTable<Features, T>;
export type Row<T extends object> = NativeRow<Features, T>;
export type Cell<T extends object, V = unknown> = NativeCell<Features, T, V>;
export type SortingFn<T extends object> = NativeSortFn<Features, T>;
export type TableOptions<T extends object> = NativeTableOptions<Features, T>;
export type VisibilityState = ColumnVisibilityState;
export type { OnChangeFn, RowSelectionState, SortingState, Updater } from "@tanstack/react-table";
