/**
 * Helper tipado para definir columnas nativas de TanStack Table sin perder
 * la inferencia de `T`. Equivale a `ColumnDef<T>[]` pero con la augmentación
 * de meta (`columnMeta.ts`) cargada automáticamente.
 *
 * Uso recomendado para nuevos call-sites (Fase 2 del refactor):
 *
 *   const columns = defineColumns<EmbarqueRow>([
 *     { id: "expediente", header: "Expediente",
 *       accessorFn: r => r.expediente,
 *       cell: ({ row }) => <ExpedienteCell embarque={row.original} />,
 *       enableSorting: true,
 *       meta: { width: "w-[130px]", sticky: true } },
 *   ]);
 */
import type { ColumnDef } from "@tanstack/react-table";
import "./columnMeta";

export function defineColumns<T>(cols: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  return cols;
}

export type { ColumnDef } from "@tanstack/react-table";
