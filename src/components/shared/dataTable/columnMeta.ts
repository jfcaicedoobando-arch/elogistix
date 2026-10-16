/** Per-table visual metadata, bound by tableFeatures (no global augmentation). */
import type { ColumnAlign } from "./types";

export interface LibreCargaColumnMeta {
  className?: string;
  headerClassName?: string;
  width?: string;
  align?: ColumnAlign;
  sticky?: boolean;
  stickyRight?: boolean;
}
