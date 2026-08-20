/**
 * PagoRepCell — celda de estado/acciones del REP para el historial de pagos.
 * Extraído de `FacturaPagosSection` (Power of 10: ≤200 líneas).
 * v13.308.13 · Añade reintentar timbrado cuando el REP quedó en "Error".
 */
import { Eye, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { CfdiEstadoBadge } from "@/features/facturacion/components/CfdiEstadoBadge";
import { useTimbrarRep } from "@/features/facturacion/hooks";
import { Hint } from "@/components/shared/Hint";

interface Props {
  pagoId: string;
  facturaId?: string;
  estadoRep: string | null;
  serieRep: string | null;
  folioRep: number | string | null;
  onPreview: (pagoId: string, label: string) => void;
}

export function PagoRepCell({ pagoId, facturaId, estadoRep, serieRep, folioRep, onPreview }: Props) {
  const repTimbrado = estadoRep === "Timbrado" && folioRep != null;
  const repCancelado = estadoRep === "Cancelado";
  const repError = estadoRep === "Error";
  const timbrar = useTimbrarRep(facturaId);

  if (repTimbrado) {
    const label = `${serieRep ?? ""}${folioRep}`;
    return (
      <div className="flex items-center gap-1.5">
        <CfdiEstadoBadge tono="timbrada" mono>{label}</CfdiEstadoBadge>
        <Hint label="Previsualizar PDF del REP">
          <Button
            variant="outline" size="icon" className="h-6 w-6"
            aria-label="Previsualizar PDF del REP"
            onClick={(e) => { e.stopPropagation(); onPreview(pagoId, label); }}
          >
            <Eye className="h-3 w-3" />
          </Button>
        </Hint>
        <FacturaDownloadButton stored={null} kind="pdf" pagoId={pagoId} size="icon" className="h-6 w-6" />
        <FacturaDownloadButton stored={null} kind="xml" pagoId={pagoId} size="icon" className="h-6 w-6" />
      </div>
    );
  }
  if (repCancelado) {
    // Ola 13 · R4P-01: el pago puede re-timbrar su REP; el cancelado queda
    // archivado como antecedente (trazabilidad), sin una segunda cancelación.
    return (
      <div className="flex items-center gap-1.5">
        <CfdiEstadoBadge tono="cancelada">REP cancelado</CfdiEstadoBadge>
        <Hint label="Re-timbrar REP (el cancelado queda archivado como antecedente)">
          <Button
            variant="outline" size="icon" className="h-6 w-6"
            aria-label="Re-timbrar REP (el cancelado queda archivado como antecedente)"
            disabled={timbrar.isPending}
            onClick={(e) => { e.stopPropagation(); timbrar.mutate(pagoId); }}
          >
            <RotateCw className={`h-3 w-3 ${timbrar.isPending ? "animate-spin" : ""}`} />
          </Button>
        </Hint>
      </div>
    );
  }
  if (repError) {
    return (
      <div className="flex items-center gap-1.5">
        <CfdiEstadoBadge tono="borrador">REP con error</CfdiEstadoBadge>
        <Hint label="Reintentar timbrado del REP">
          <Button
            variant="outline" size="icon" className="h-6 w-6"
            aria-label="Reintentar timbrado del REP"
            disabled={timbrar.isPending}
            onClick={(e) => { e.stopPropagation(); timbrar.mutate(pagoId); }}
          >
            <RotateCw className={`h-3 w-3 ${timbrar.isPending ? "animate-spin" : ""}`} />
          </Button>
        </Hint>
      </div>
    );
  }
  return <CfdiEstadoBadge tono="borrador">REP pendiente</CfdiEstadoBadge>;
}
