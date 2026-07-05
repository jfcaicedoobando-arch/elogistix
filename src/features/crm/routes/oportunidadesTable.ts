import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import type { CrmOportunidadRow } from "@/features/crm/hooks";
import type { OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";

export const oportunidadesColumns: ColumnDef<CrmOportunidadRow, unknown>[] = defineColumns<CrmOportunidadRow>([
  {
    id: "nombre",
    header: "Oportunidad",
    meta: { width: "min-w-[180px]", className: "font-medium whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.nombre,
  },
  {
    id: "cliente",
    header: "Cliente",
    meta: { width: "min-w-[160px]", className: "max-w-[220px] truncate" },
    cell: ({ row }) => row.original.cliente_nombre || "—",
  },
  {
    ...moneyColumn<CrmOportunidadRow>({
      id: "monto",
      header: "Monto",
      accessor: (r) => Number(r.monto_estimado ?? 0),
      currencyAccessor: (r) => r.moneda,
    }),
    meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap text-xs" },
  },
  {
    id: "prob",
    header: "Prob",
    meta: { width: "w-[70px]", align: "center", className: "text-center text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    cell: ({ row }) => `${row.original.probabilidad}%`,
  },
  {
    ...dateColumn<CrmOportunidadRow>({
      id: "fecha",
      header: "Cierre est.",
      accessor: (r) => r.fecha_estimada_cierre,
    }),
    meta: { width: "w-[120px]", className: "text-xs whitespace-nowrap" },
  },
  {
    id: "vendedor",
    header: "Vendedor",
    meta: { width: "w-[180px]", className: "text-xs truncate hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    cell: ({ row }) => row.original.vendedor_email || "—",
  },
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
