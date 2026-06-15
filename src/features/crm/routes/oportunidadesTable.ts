import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrencyCompact } from "@/lib/formatters";
import type { CrmOportunidadRow } from "@/features/crm/hooks";
import type { OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";

export const oportunidadesColumns: ColumnDef<CrmOportunidadRow, unknown>[] = defineColumns<CrmOportunidadRow>([
  { id: "nombre", header: "Oportunidad", meta: { className: "font-medium" }, cell: ({ row }) => row.original.nombre },
  { id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente_nombre || "—" },
  {
    id: "monto",
    header: "Monto",
    meta: { className: "text-right tabular-nums text-xs" },
    cell: ({ row }) => formatCurrencyCompact(Number(row.original.monto_estimado ?? 0), row.original.moneda),
  },
  { id: "prob", header: "Prob", meta: { className: "text-center text-xs" }, cell: ({ row }) => `${row.original.probabilidad}%` },
  { id: "fecha", header: "Cierre est.", meta: { className: "text-xs" }, cell: ({ row }) => row.original.fecha_estimada_cierre || "—" },
  { id: "vendedor", header: "Vendedor", meta: { className: "text-xs" }, cell: ({ row }) => row.original.vendedor_email || "—" },
]);

export function activosFiltros(f: OportunidadesFiltros): number {
  let n = 0;
  if (f.etapaId !== "todas") n++;
  if (f.vendedorId !== "todos") n++;
  if (f.cierreDesde) n++;
  if (f.cierreHasta) n++;
  if (f.montoMin) n++;
  return n;
}
