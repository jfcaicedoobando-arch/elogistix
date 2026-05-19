/**
 * Augmentación del tipo `ColumnMeta` de `@tanstack/react-table` para que
 * las columnas puedan llevar metadatos visuales (ancho, alineación,
 * sticky, className) tipados de manera segura sin recurrir a `any`.
 *
 * Importar este archivo en cualquier punto carga la declaración global y
 * deja `column.columnDef.meta` con autocompletado en todo el proyecto.
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
