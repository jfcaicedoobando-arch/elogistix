import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/DataTable";
import { formatDate, formatCurrency, shortName, getOrigen, getDestino } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/uiMappings";

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

export const embarqueColumns: DataTableColumn<EmbarqueCliente>[] = [
  { key: "expediente", header: "Expediente", width: "w-[110px]", className: "font-medium", render: (e) => e.expediente },
  { key: "modo", header: "Modo", width: "w-[90px]", className: "text-xs", render: (e) => e.modo },
  { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs", render: (e) => `${shortName(getOrigen(e))} → ${shortName(getDestino(e))}` },
  { key: "estado", header: "Estado", width: "w-[100px]", render: (e) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(e.estado)}`}>{e.estado}</Badge> },
  { key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs", render: (e) => formatDate(e.etd || "") },
  { key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs", render: (e) => formatDate(e.eta || "") },
];

export const cotizacionColumns: DataTableColumn<CotizacionCliente>[] = [
  { key: "folio", header: "Folio", width: "w-[100px]", className: "font-medium", render: (c) => c.folio },
  { key: "modo", header: "Modo", width: "w-[80px]", className: "text-xs", render: (c) => c.modo },
  { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs", render: (c) => `${c.origen || "-"} → ${c.destino || "-"}` },
  { key: "subtotal", header: "Subtotal", width: "w-[110px]", className: "text-right text-xs", headerClassName: "text-right", render: (c) => formatCurrency(c.subtotal, c.moneda) },
  { key: "estado", header: "Estado", width: "w-[100px]", render: (c) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(c.estado)}`}>{c.estado}</Badge> },
  { key: "fecha", header: "Fecha", width: "w-[100px]", className: "text-xs", render: (c) => formatDate(c.created_at) },
];
