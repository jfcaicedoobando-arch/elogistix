import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatDate, formatCurrency, shortName, getOrigen, getDestino } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";

export type EmbarqueCliente = {
  id: string;
  expediente: string;
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
  { id: "expediente", header: "Expediente", meta: { width: "w-[110px]", className: "font-medium" }, cell: ({ row }) => row.original.expediente },
  { id: "modo", header: "Modo", meta: { width: "w-[90px]", className: "text-xs" }, cell: ({ row }) => row.original.modo },
  { id: "ruta", header: "Origen → Destino", meta: { width: "min-w-[160px]", className: "text-xs" }, cell: ({ row }) => `${shortName(getOrigen(row.original))} → ${shortName(getDestino(row.original))}` },
  { id: "estado", header: "Estado", meta: { width: "w-[100px]" }, cell: ({ row }) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(row.original.estado)}`}>{row.original.estado}</Badge> },
  { id: "etd", header: "ETD", meta: { width: "w-[90px]", className: "text-xs" }, cell: ({ row }) => formatDate(row.original.etd || "") },
  { id: "eta", header: "ETA", meta: { width: "w-[90px]", className: "text-xs" }, cell: ({ row }) => formatDate(row.original.eta || "") },
]);

export const cotizacionColumns: ColumnDef<CotizacionCliente, unknown>[] = defineColumns<CotizacionCliente>([
  { id: "folio", header: "Folio", meta: { width: "w-[100px]", className: "font-medium" }, cell: ({ row }) => row.original.folio },
  { id: "modo", header: "Modo", meta: { width: "w-[80px]", className: "text-xs" }, cell: ({ row }) => row.original.modo },
  { id: "ruta", header: "Origen → Destino", meta: { width: "min-w-[160px]", className: "text-xs" }, cell: ({ row }) => `${row.original.origen || "-"} → ${row.original.destino || "-"}` },
  { id: "subtotal", header: "Subtotal", meta: { width: "w-[110px]", align: "right", className: "text-xs tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.subtotal, row.original.moneda) },
  { id: "estado", header: "Estado", meta: { width: "w-[100px]" }, cell: ({ row }) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(row.original.estado)}`}>{row.original.estado}</Badge> },
  { id: "fecha", header: "Fecha", meta: { width: "w-[100px]", className: "text-xs" }, cell: ({ row }) => formatDate(row.original.created_at) },
]);
