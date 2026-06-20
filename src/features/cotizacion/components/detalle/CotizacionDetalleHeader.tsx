import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileDown, Mail } from "lucide-react";
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

export function CotizacionDetalleHeader({ cotizacion, nombreDestinatario, onBack, onExportarPdf, onEnviarEmail, yaEnviada }: Props) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver a cotizaciones">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold">{cotizacion.folio}</h1>
        <p className="text-sm text-muted-foreground truncate">{toTitleCase(nombreDestinatario)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge className={getEstadoColor(cotizacion.estado)}>{cotizacion.estado}</Badge>
        {cotizacion.fecha_aceptacion && (
          <span className="text-xs text-muted-foreground">
            Aceptada el {formatDate(cotizacion.fecha_aceptacion, "dd/MM/yyyy HH:mm")}
          </span>
        )}
        {cotizacion.fecha_rechazo && (
          <span className="text-xs text-muted-foreground">
            Rechazada el {formatDate(cotizacion.fecha_rechazo, "dd/MM/yyyy HH:mm")}
          </span>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onExportarPdf}>
        <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
      </Button>
      {onEnviarEmail && !cotizacion.es_prospecto && (
        <Button variant="default" size="sm" onClick={onEnviarEmail}>
          <Mail className="h-4 w-4 mr-1" /> {yaEnviada ? "Reenviar" : "Enviar por correo"}
        </Button>
      )}
    </div>
  );
}

