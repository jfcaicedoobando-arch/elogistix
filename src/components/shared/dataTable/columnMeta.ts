/**
 * Augmentación del tipo `ColumnMeta` de @tanstack/react-table para que las
 * columnas puedan llevar metadatos visuales (ancho, alineación, sticky, etc.)
 * tipados de manera segura — son los que antes vivían como props sueltas en
 * `DataTableColumn<T>` (API legacy).
 *
 * Importar este archivo en cualquier punto carga la declaración global y
 * deja `column.columnDef.meta` con autocompletado.
 */
import type { RowData } from "@tanstack/react-table";
import type { ColumnAlign } from "./types";

export interface LibreCargaColumnMeta {
  className?: string;
  headerClassName?: string;
  width?: string;
  align?: ColumnAlign;
  sticky?: boolean;
  stickyRight?: boolean;
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- requerido por TanStack
  interface ColumnMeta<TData extends RowData, TValue> extends LibreCargaColumnMeta {}
}
