import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  statusColumn,
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase, formatPercent, formatCurrency } from "@/lib/formatters";
import { comisionSinEmbarque } from "../domain/cobroSinEmbarque";
import type { ComisionDevengada } from "@/features/comisiones/services";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

/** Búsqueda y orden de la lista sobre los campos que representa esta tabla. */
export const comisionSearchAccessor = (r: ComisionDevengada): string =>
  `${r.factura_numero ?? ""} ${r.cliente_nombre ?? ""} ${r.expediente ?? ""}`;

export const comisionesSorters: Record<string, (a: ComisionDevengada, b: ComisionDevengada) => number> = {
  factura: (a, b) => (a.factura_numero ?? "").localeCompare(b.factura_numero ?? ""),
  cliente: (a, b) => (a.cliente_nombre ?? "").localeCompare(b.cliente_nombre ?? ""),
  cobrado: (a, b) => {
    if (a.monto_cobrado_mxn === null) return b.monto_cobrado_mxn === null ? 0 : 1;
    if (b.monto_cobrado_mxn === null) return -1;
    return a.monto_cobrado_mxn - b.monto_cobrado_mxn;
  },
  utilidad: (a, b) => a.utilidad_prorrateada_mxn - b.utilidad_prorrateada_mxn,
  porcentaje: (a, b) => a.porcentaje_aplicado - b.porcentaje_aplicado,
  comision: (a, b) => a.comision_mxn - b.comision_mxn,
  fecha: (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""),
};

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
      id: "vendedora", header: "Vendedora",
      meta: { width: COL_W.nombre, className: "max-w-[180px] truncate hidden lg:table-cell", headerClassName: "hidden lg:table-cell" },
      cell: ({ row }) => row.original.vendedora_nombre ?? "—",
    },
    {
      id: "factura", header: "Factura",
      meta: { width: COL_W.fecha, className: "font-mono text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.factura_numero ?? "—",
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "cobrado", header: "Cobrado (MXN)",
        accessor: (c) => c.monto_cobrado_mxn,
        defaultCurrency: "MXN",
      }),
      accessorFn: (c) => c.monto_cobrado_mxn,
      cell: ({ row }) => row.original.monto_cobrado_mxn === null
        ? "No calculado"
        : formatCurrency(row.original.monto_cobrado_mxn, "MXN"),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap" },
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "utilidad", header: "Utilidad prorrateada",
        accessor: (c) => c.utilidad_prorrateada_mxn,
        defaultCurrency: "MXN",
      }),
      cell: ({ row }) => comisionSinEmbarque(row.original)
        ? "No calculada" : formatCurrency(row.original.utilidad_prorrateada_mxn, "MXN"),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      id: "pct", header: "%",
      meta: { width: COL_W.tiny, className: "text-right tabular-nums hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => comisionSinEmbarque(row.original) ? "No aplica" : formatPercent(row.original.porcentaje_aplicado),
    },
    {
      ...moneyColumn<ComisionDevengada>({
        id: "comision", header: "Comisión (MXN)",
        accessor: (c) => c.comision_mxn,
        defaultCurrency: "MXN",
      }),
      cell: ({ row }) => comisionSinEmbarque(row.original)
        ? <span>No calculada<span className="block text-xs font-normal text-muted-foreground">Sin embarque asociado</span></span>
        : formatCurrency(row.original.comision_mxn, "MXN"),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums font-semibold" },
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
