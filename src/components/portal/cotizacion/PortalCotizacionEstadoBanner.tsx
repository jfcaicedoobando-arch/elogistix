import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Info, MessageSquare } from "lucide-react";

interface PortalCotizacionEstadoBannerProps {
  estado: string;
  comentarioCliente?: string | null;
}

/** Banner contextual según el estado de la cotización (Aceptada/Rechazada/Enviada). */
export default function PortalCotizacionEstadoBanner({
  estado,
  comentarioCliente,
}: PortalCotizacionEstadoBannerProps) {
  if (estado === "Aceptada") {
    return (
      <Alert className="border-success/50 bg-success/10">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertDescription className="text-success">
          <p>Esta cotización fue aceptada. El equipo procederá con la operación.</p>
          {comentarioCliente && (
            <p className="mt-2 flex items-start gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="italic">"{comentarioCliente}"</span>
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (estado === "Rechazada") {
    return (
      <Alert className="border-destructive/50 bg-destructive/10">
        <XCircle className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-destructive">
          <p>Esta cotización fue rechazada.</p>
          {comentarioCliente && (
            <p className="mt-2 flex items-start gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="italic">"{comentarioCliente}"</span>
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (estado === "Enviada") {
    return (
      <Alert className="border-info/50 bg-info/10">
        <Info className="h-4 w-4 text-info" />
        <AlertDescription className="text-info">
          Esta cotización está pendiente de tu respuesta. Puedes aceptarla o rechazarla.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
