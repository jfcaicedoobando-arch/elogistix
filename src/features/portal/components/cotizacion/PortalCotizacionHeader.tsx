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

/**
 * Header con título, estado y acciones de aceptar/rechazar (solo si Enviada).
 * En mobile las acciones se muestran como action bar sticky en el bottom
 * (por encima del PortalBottomNav, `bottom-16`), liberando espacio en el header.
 */
export default function PortalCotizacionHeader({
  folio,
  estado,
  clienteNombre,
  onBack,
  onAceptar,
  onRechazar,
}: PortalCotizacionHeaderProps) {
  const showActions = estado === "Enviada";

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono tabular-nums">{folio}</h1>
            <Badge className={getEstadoColor(estado)}>{estado}</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate" title={clienteNombre}>
            {toTitleCase(clienteNombre)}
          </p>
        </div>

        {showActions && (
          <div className="hidden md:flex gap-2">
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

      {showActions && (
        <div className="md:hidden fixed bottom-16 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 px-4 py-3">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              onClick={onRechazar}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
            <Button
              className="flex-1 bg-success text-success-foreground hover:bg-success/90"
              onClick={onAceptar}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aceptar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
