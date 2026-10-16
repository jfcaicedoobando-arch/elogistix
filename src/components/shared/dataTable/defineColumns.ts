/**
 * Helper tipado para definir columnas nativas de TanStack Table sin perder
 * la inferencia de `T`. Los tipos están vinculados a las features y metadatos
 * locales de la tabla, sin augmentación global ni adaptador legacy.
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
import type { ColumnDef } from "@/components/shared/dataTable/tanstackTypes";

export function defineColumns<T extends object>(cols: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  return cols;
}

export type { ColumnDef } from "@/components/shared/dataTable/tanstackTypes";
