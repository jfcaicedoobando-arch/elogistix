/**
 * Fila individual del historial de pagos.
 * Extraído de DialogHistorialPagos para mantener archivos < 200 LOC (Power of 10).
 */
import { Receipt, FileText, FileCode, Ban, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";

export type EstadoRep = "NoAplica" | "Pendiente" | "Timbrado" | "Cancelado" | "Error";

export function badgeRep(estado: EstadoRep) {
  switch (estado) {
    case "Timbrado":  return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Timbrado</Badge>;
    case "Pendiente": return <Badge variant="destructive">Pendiente</Badge>;
    case "Cancelado": return <Badge variant="outline">Cancelado</Badge>;
    case "Error":     return <Badge variant="destructive">Error</Badge>;
    default:          return <Badge variant="outline" className="text-muted-foreground">N/A</Badge>;
  }
}

export interface PagoRowData {
  id: string;
  fecha_pago: string | Date;
  monto: number | string;
  moneda: string;
  monto_aplicado_factura: number | string;
  tipo_cambio: number | string;
  diferencia_cambiaria_mxn: number | string | null;
  forma_pago: string | null;
  referencia: string | null;
  estado_rep: string | null;
  rep_pdf_url: string | null;
  rep_xml_url: string | null;
  rep_error: string | null;
}

interface Props {
  pago: PagoRowData;
  facturaMoneda: string;
  tcFactura?: number;
  canEdit: boolean;
  onTimbrarRep: (pagoId: string) => void;
  onCancelarRep: (pagoId: string) => void;
  onEliminar: (pagoId: string) => void;
}

export function PagoFacturaRow({
  pago, facturaMoneda, tcFactura, canEdit,
  onTimbrarRep, onCancelarRep, onEliminar,
}: Props) {
  const tcPago = Number(pago.tipo_cambio) || 1;
  const dif = Number(pago.diferencia_cambiaria_mxn) || 0;
  const tieneDif = Math.abs(dif) > 0.005;
  const estadoRep = (pago.estado_rep ?? "NoAplica") as EstadoRep;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="py-2 px-2 whitespace-nowrap">{formatDate(pago.fecha_pago)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(Number(pago.monto), pago.moneda)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(Number(pago.monto_aplicado_factura), facturaMoneda)}</td>
      {tcFactura !== undefined && (
        <>
          <td className="py-2 px-2 text-right tabular-nums text-xs whitespace-nowrap">
            {tcPago.toFixed(4)} / {tcFactura.toFixed(4)}
          </td>
          <td className={`py-2 px-2 text-right tabular-nums text-xs whitespace-nowrap ${tieneDif ? (dif > 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>
            {tieneDif ? formatCurrency(dif, "MXN") : "—"}
          </td>
        </>
      )}
      <td className="py-2 px-2">{pago.forma_pago}</td>
      <td className="py-2 px-2 max-w-[200px] truncate" title={pago.referencia ?? ""}>{pago.referencia || "—"}</td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          {badgeRep(estadoRep)}
          {canEdit && estadoRep === "Pendiente" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Timbrar REP"
              onClick={(e) => { e.stopPropagation(); onTimbrarRep(pago.id); }}>
              <Receipt className="h-4 w-4" />
            </Button>
          )}
          {canEdit && estadoRep === "Error" && (
            <Button variant="ghost" size="icon" className="h-7 w-7"
              title={`Reintentar REP — ${pago.rep_error ?? "Error"}`}
              onClick={(e) => { e.stopPropagation(); onTimbrarRep(pago.id); }}>
              <Receipt className="h-4 w-4 text-destructive" />
            </Button>
          )}
          {estadoRep === "Timbrado" && pago.rep_pdf_url && (
            <a href={pago.rep_pdf_url} target="_blank" rel="noopener noreferrer"
              title="Descargar PDF del REP"
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}>
              <FileText className="h-4 w-4" />
            </a>
          )}
          {estadoRep === "Timbrado" && pago.rep_xml_url && (
            <a href={pago.rep_xml_url} target="_blank" rel="noopener noreferrer"
              title="Descargar XML del REP"
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}>
              <FileCode className="h-4 w-4" />
            </a>
          )}
          {canEdit && estadoRep === "Timbrado" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Cancelar REP"
              onClick={(e) => { e.stopPropagation(); onCancelarRep(pago.id); }}>
              <Ban className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </td>
      {canEdit && (
        <td className="py-2 px-2">
          <Button variant="ghost" size="icon"
            onClick={(e) => { e.stopPropagation(); onEliminar(pago.id); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </td>
      )}
    </tr>
  );
}
