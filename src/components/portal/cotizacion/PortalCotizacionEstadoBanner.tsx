import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Info, MessageSquare, Ship, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PortalCotizacionEstadoBannerProps {
  estado: string;
  comentarioCliente?: string | null;
  embarqueId?: string | null;
  embarqueExpediente?: string | null;
}

/** Banner contextual según el estado de la cotización (Aceptada/En operación/Rechazada/Enviada). */
export default function PortalCotizacionEstadoBanner({
  estado,
  comentarioCliente,
  embarqueId,
  embarqueExpediente,
}: PortalCotizacionEstadoBannerProps) {
  const navigate = useNavigate();

  // Si la cotización ya tiene un embarque vinculado (independiente del estado),
  // mostramos el banner de operación con acceso directo al embarque.
  if (embarqueId) {
    return (
      <Alert className="border-success/40 bg-success/15">
        <Ship className="h-4 w-4 text-success" />
        <AlertDescription className="text-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p>
              Esta cotización ya está en operación.
              {embarqueExpediente && (
                <span className="ml-1 font-semibold font-mono">Embarque {embarqueExpediente}.</span>
              )}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-success text-success hover:bg-success/20"
              onClick={() => navigate(`/portal/embarques/${embarqueId}`)}
            >
              Ver embarque <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          {comentarioCliente && (
            <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="italic">"{comentarioCliente}"</span>
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (estado === "Aceptada") {
    return (
      <Alert className="border-success/40 bg-success/15">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertDescription className="text-foreground">
          <p>Esta cotización fue aceptada. Te notificaremos cuando inicie la operación.</p>
          {comentarioCliente && (
            <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
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
