import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  statusColumn,
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import type { ComisionDevengada } from "@/features/comisiones/services";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export function buildComisionesColumns(): ColumnDef<ComisionDevengada, unknown>[] {
  return defineColumns<ComisionDevengada>([
    {
      ...dateColumn<ComisionDevengada>({
        id: "fecha", header: "Fecha",
        accessor: (c) => c.created_at?.slice(0, 10) ?? null,
      }),
      meta: { width: COL_W.fecha, className: "whitespace-nowrap", sticky: true },
    },
    {
      id: "expediente", header: "Expediente",
      meta: { width: COL_W.monto, className: "font-mono text-xs" },
      cell: ({ row }) => row.original.expediente ?? "—",
    },
    {
      id: "cliente", header: "Cliente",
      meta: { width: COL_W.nombre, className: "max-w-[200px] truncate" },
      cell: ({ row }) => row.original.cliente_nombre ? toTitleCase(row.original.cliente_nombre) : "—",
    },
    {
      id: "factura", header: "Factura",
      meta: { width: COL_W.fecha, className: "font-mono text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.factura_numero ?? "—",
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "cobrado", header: "Cobrado (MXN)",
        accessor: (c) => c.monto_cobrado_mxn,
        defaultCurrency: "MXN",
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap" },
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "utilidad", header: "Utilidad prorrateada",
        accessor: (c) => c.utilidad_prorrateada_mxn,
        defaultCurrency: "MXN",
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      id: "pct", header: "%",
      meta: { width: COL_W.tiny, className: "text-right tabular-nums hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => `${row.original.porcentaje_aplicado.toFixed(1)}%`,
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "comision", header: "Comisión (MXN)",
        accessor: (c) => c.comision_mxn,
        defaultCurrency: "MXN",
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      ...statusColumn<ComisionDevengada>({
        id: "estado", header: "Estado",
        domain: "comision",
        accessor: (c) => c.estado,
      }),
      sortingFn: sortByString<ComisionDevengada>((c) => c.estado),
      meta: { width: COL_W.fecha },
    },
    {
      id: "nota", header: "Nota",
      meta: { width: COL_W.nombre, className: "text-xs text-muted-foreground hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.nota ?? "—",
    },
  ]);
}
