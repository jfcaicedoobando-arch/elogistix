import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  statusColumn,
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import type { ComisionDevengada } from "@/features/comisiones/services";

export function buildComisionesColumns(): ColumnDef<ComisionDevengada, unknown>[] {
  return defineColumns<ComisionDevengada>([
    {
      ...dateColumn<ComisionDevengada>({
        id: "fecha", header: "Fecha",
        accessor: (c) => c.created_at?.slice(0, 10) ?? null,
      }),
      meta: { width: "w-[110px]", className: "whitespace-nowrap", sticky: true },
    },
    {
      id: "expediente", header: "Expediente",
      meta: { width: "w-[140px]", className: "font-mono text-xs" },
      cell: ({ row }) => row.original.expediente ?? "—",
    },
    {
      id: "cliente", header: "Cliente",
      meta: { width: "min-w-[140px]", className: "max-w-[200px] truncate" },
      cell: ({ row }) => row.original.cliente_nombre ? toTitleCase(row.original.cliente_nombre) : "—",
    },
    {
      id: "factura", header: "Factura",
      meta: { width: "w-[110px]", className: "font-mono text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.factura_numero ?? "—",
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "cobrado", header: "Cobrado (MXN)",
        accessor: (c) => c.monto_cobrado_mxn,
        defaultCurrency: "MXN",
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap" },
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "utilidad", header: "Utilidad prorrateada",
        accessor: (c) => c.utilidad_prorrateada_mxn,
        defaultCurrency: "MXN",
      }),
      meta: { width: "w-[150px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      id: "pct", header: "%",
      meta: { width: "w-[60px]", className: "text-right tabular-nums hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => `${row.original.porcentaje_aplicado.toFixed(1)}%`,
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "comision", header: "Comisión (MXN)",
        accessor: (c) => c.comision_mxn,
        defaultCurrency: "MXN",
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      ...statusColumn<ComisionDevengada>({
        id: "estado", header: "Estado",
        domain: "comision",
        accessor: (c) => c.estado,
      }),
      sortingFn: sortByString<ComisionDevengada>((c) => c.estado),
      meta: { width: "w-[110px]" },
    },
    {
      id: "nota", header: "Nota",
      meta: { width: "min-w-[120px]", className: "text-xs text-muted-foreground hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.nota ?? "—",
    },
  ]);
}
