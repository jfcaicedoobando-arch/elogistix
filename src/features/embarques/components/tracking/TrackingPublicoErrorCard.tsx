import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { AvisoAccionable } from "@/components/shared/states/AvisoAccionable";
import { COPY_ENLACE, COPY_PASOS } from "@/lib/copy/publicoCopy";
import { mensajeTrackingAmigable } from "./trackingErrorCopy";

export function TrackingPublicoErrorCard({ message }: { message?: string }) {
  const descripcion = mensajeTrackingAmigable(message);
  const esEnlace = descripcion === COPY_ENLACE.invalido;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="py-8">
          <AvisoAccionable
            tono="error"
            icon={<AlertTriangle className="h-6 w-6" />}
            titulo={esEnlace ? "No pudimos abrir este seguimiento" : "El seguimiento no está disponible"}
            descripcion={descripcion}
            pasos={esEnlace ? COPY_PASOS.enlaceInvalido : COPY_PASOS.servicioNoDisponible}
            accion={
              <Link to="/" className="text-body font-medium text-accent hover:underline">
                Volver al inicio
              </Link>
            }
            className="border-0 p-0"
          />
        </CardContent>
      </Card>
    </div>
  );
}
