import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileDown, Mail, FileSpreadsheet } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { toTitleCase, formatDate } from "@/lib/formatters";
import type { CotizacionRow } from "@/features/cotizacion/types";

interface Props {
  cotizacion: CotizacionRow;
  nombreDestinatario: string;
  onBack: () => void;
  onExportarPdf: () => void;
  onEnviarEmail?: () => void;
  yaEnviada?: boolean;
}

export function CotizacionDetalleHeader({ cotizacion, nombreDestinatario, onExportarPdf, onEnviarEmail, yaEnviada }: Props) {
  // R-08: una cotización sin importe no puede enviarse al cliente.
  const sinImporte = !(Number(cotizacion.total) > 0);
  const metaFecha = cotizacion.fecha_aceptacion
    ? `Aceptada el ${formatDate(cotizacion.fecha_aceptacion, "dd/MM/yyyy HH:mm")}`
    : cotizacion.fecha_rechazo
      ? `Rechazada el ${formatDate(cotizacion.fecha_rechazo, "dd/MM/yyyy HH:mm")}`
      : null;

  return (
    <DetailHeader
      backTo="/cotizaciones"
      backLabel="Volver a Cotizaciones"
      icon={<FileSpreadsheet className="h-6 w-6 text-accent shrink-0" />}
      title={cotizacion.folio}
      subtitle={toTitleCase(nombreDestinatario)}
      badge={<Badge className={getEstadoColor(cotizacion.estado)}>{cotizacion.estado}</Badge>}
      meta={metaFecha ? <span className="text-xs text-muted-foreground">{metaFecha}</span> : undefined}
      trailing={
        <>
          <Button variant="outline" size="sm" onClick={onExportarPdf}>
            <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
          {onEnviarEmail && !cotizacion.es_prospecto && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={sinImporte ? 0 : -1}>
                    <Button variant="default" size="sm" onClick={onEnviarEmail} disabled={sinImporte}>
                      <Mail className="h-4 w-4 mr-1" /> {yaEnviada ? "Reenviar" : "Enviar por correo"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {sinImporte && (
                  <TooltipContent>
                    Agrega conceptos de venta con importe antes de enviar la cotización.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      }
    />
  );
}


