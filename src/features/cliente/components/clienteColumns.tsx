import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatDate, formatCurrency, shortName, getOrigen, getDestino } from "@/lib/formatters";

export type EmbarqueCliente = {
  id: string;
  expediente: string | null;
  modo: string;
  estado: string;
  etd: string | null;
  eta: string | null;
  puerto_origen: string | null;
  aeropuerto_origen: string | null;
  ciudad_origen: string | null;
  puerto_destino: string | null;
  aeropuerto_destino: string | null;
  ciudad_destino: string | null;
};

export type CotizacionCliente = {
  id: string;
  folio: string;
  modo: string;
  estado: string;
  origen: string;
  destino: string;
  subtotal: number;
  moneda: string;
  created_at: string;
};

export const embarqueColumns: ColumnDef<EmbarqueCliente, unknown>[] = defineColumns<EmbarqueCliente>([
  { id: "expediente", header: "Expediente", meta: { width: COL_W.folio, className: "font-medium" }, cell: ({ row }) => row.original.expediente },
  { id: "modo", header: "Modo", meta: { width: COL_W.short, className: "text-xs" }, cell: ({ row }) => row.original.modo },
  { id: "ruta", header: "Origen → Destino", meta: { width: COL_W.ruta, className: "text-xs" }, cell: ({ row }) => `${shortName(getOrigen(row.original))} → ${shortName(getDestino(row.original))}` },
  {
    ...statusColumn<EmbarqueCliente>({
      id: "estado",
      header: "Estado",
      domain: "embarque",
      accessor: (e) => e.estado,
    }),
    meta: { width: COL_W.estado },
  },
  { id: "etd", header: "ETD", meta: { width: COL_W.fecha, className: "text-xs" }, cell: ({ row }) => formatDate(row.original.etd || "") },
  { id: "eta", header: "ETA", meta: { width: COL_W.fecha, className: "text-xs" }, cell: ({ row }) => formatDate(row.original.eta || "") },
]);

export const cotizacionColumns: ColumnDef<CotizacionCliente, unknown>[] = defineColumns<CotizacionCliente>([
  { id: "folio", header: "Folio", meta: { width: COL_W.folio, className: "font-medium" }, cell: ({ row }) => row.original.folio },
  { id: "modo", header: "Modo", meta: { width: COL_W.short, className: "text-xs" }, cell: ({ row }) => row.original.modo },
  { id: "ruta", header: "Origen → Destino", meta: { width: COL_W.ruta, className: "text-xs" }, cell: ({ row }) => `${row.original.origen || "-"} → ${row.original.destino || "-"}` },
  { id: "subtotal", header: "Subtotal", meta: { width: COL_W.monto, align: "right", className: "text-xs tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.subtotal, row.original.moneda) },
  { ...statusColumn<CotizacionCliente>({ id: "estado", header: "Estado", domain: "cotizacion", accessor: (c) => c.estado }), meta: { width: COL_W.estado } },
  { id: "fecha", header: "Fecha", meta: { width: COL_W.fecha, className: "text-xs" }, cell: ({ row }) => formatDate(row.original.created_at) },
]);
