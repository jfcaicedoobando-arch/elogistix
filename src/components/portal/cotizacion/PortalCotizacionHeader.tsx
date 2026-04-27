import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { toTitleCase } from "@/lib/formatters";

interface PortalCotizacionHeaderProps {
  folio: string;
  estado: string;
  clienteNombre: string;
  onBack: () => void;
  onAceptar: () => void;
  onRechazar: () => void;
}

/** Header con título, estado y acciones de aceptar/rechazar (solo si Enviada). */
export default function PortalCotizacionHeader({
  folio,
  estado,
  clienteNombre,
  onBack,
  onAceptar,
  onRechazar,
}: PortalCotizacionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{folio}</h1>
          <Badge className={getEstadoColor(estado)}>{estado}</Badge>
        </div>
        <p className="text-sm text-muted-foreground" title={clienteNombre}>{toTitleCase(clienteNombre)}</p>
      </div>

      {estado === "Enviada" && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={onRechazar}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rechazar
          </Button>
          <Button
            className="bg-success text-success-foreground hover:bg-success/90"
            onClick={onAceptar}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aceptar Cotización
          </Button>
        </div>
      )}
    </div>
  );
}
