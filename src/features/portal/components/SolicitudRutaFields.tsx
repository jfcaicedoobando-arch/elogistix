/**
 * Campos de ruta (origen/destino) de la solicitud de cotización del portal.
 * Defecto 3 (v13.823.43) — los mensajes de validación se anuncian con
 * `role="alert"` y se asocian al campo vía `aria-describedby`.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

interface Props {
  origen: string;
  setOrigen: (v: string) => void;
  destino: string;
  setDestino: (v: string) => void;
  intentoEnvio: boolean;
  origenVacio: boolean;
  destinoVacio: boolean;
}

export function SolicitudRutaFields({
  origen, setOrigen, destino, setDestino, intentoEnvio, origenVacio, destinoVacio,
}: Props) {
  const errorOrigen = intentoEnvio && origenVacio;
  const errorDestino = intentoEnvio && destinoVacio;

  return (
    <FormDialogSection title="Ruta" description="Puerto, aeropuerto o ciudad.">
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-origen">Origen <span className="text-destructive">*</span></Label>
        <Input id="solicitud-origen" value={origen} onChange={(e) => setOrigen(e.target.value)}
          placeholder="Shanghái, China" aria-invalid={errorOrigen}
          aria-describedby={errorOrigen ? "solicitud-origen-error" : undefined} />
        {errorOrigen && (
          <p id="solicitud-origen-error" role="alert" className="text-body-sm text-destructive">
            {COPY_VALIDACION.requerido("el origen")}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-destino">Destino <span className="text-destructive">*</span></Label>
        <Input id="solicitud-destino" value={destino} onChange={(e) => setDestino(e.target.value)}
          placeholder="Manzanillo, México" aria-invalid={errorDestino}
          aria-describedby={errorDestino ? "solicitud-destino-error" : undefined} />
        {errorDestino && (
          <p id="solicitud-destino-error" role="alert" className="text-body-sm text-destructive">
            {COPY_VALIDACION.requerido("el destino")}
          </p>
        )}
      </div>
    </FormDialogSection>
  );
}
