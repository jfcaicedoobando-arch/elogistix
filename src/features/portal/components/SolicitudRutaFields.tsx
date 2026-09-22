/**
 * Campos de ruta (origen/destino) de la solicitud de cotización del portal.
 * Defecto 3 (v13.823.43) — los mensajes de validación se anuncian con
 * `role="alert"` y se asocian al campo vía `aria-describedby`.
 * Etapa 5 — en Marítimo se captura texto + ID de puerto del catálogo; el texto
 * libre sigue permitido (ID `null`) y en otros modos se usan Inputs de texto.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import { PortSelect } from "@/features/catalogos";
import type { ModoTransporte } from "@/constants/wizardConstants";
import {
  esModoMaritimoSolicitud,
  placeholderRuta,
} from "@/features/portal/domain/solicitudRuta";

interface Props {
  modo: ModoTransporte;
  origen: string;
  setOrigen: (v: string, puertoId?: string | null) => void;
  destino: string;
  setDestino: (v: string, puertoId?: string | null) => void;
  puertoOrigenId: string | null;
  puertoDestinoId: string | null;
  intentoEnvio: boolean;
  origenVacio: boolean;
  destinoVacio: boolean;
}

export function SolicitudRutaFields({
  modo, origen, setOrigen, destino, setDestino,
  puertoOrigenId, puertoDestinoId,
  intentoEnvio, origenVacio, destinoVacio,
}: Props) {
  const errorOrigen = intentoEnvio && origenVacio;
  const errorDestino = intentoEnvio && destinoVacio;
  const maritimo = esModoMaritimoSolicitud(modo);

  return (
    <FormDialogSection title="Ruta" description="Puerto, aeropuerto o ciudad.">
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-origen">Origen <span className="text-destructive">*</span></Label>
        {maritimo ? (
          <PortSelect
            id="solicitud-origen"
            value={origen}
            onValueChange={(texto, puertoId) => setOrigen(texto, puertoId)}
            placeholder={placeholderRuta(modo, "origen")}
            excludeId={puertoDestinoId}
            aria-invalid={errorOrigen}
            aria-describedby={errorOrigen ? "solicitud-origen-error" : undefined}
          />
        ) : (
          <Input id="solicitud-origen" value={origen} onChange={(e) => setOrigen(e.target.value, null)}
            placeholder={placeholderRuta(modo, "origen")} aria-invalid={errorOrigen}
            aria-describedby={errorOrigen ? "solicitud-origen-error" : undefined} />
        )}
        {errorOrigen && (
          <p id="solicitud-origen-error" role="alert" className="text-body-sm text-destructive">
            {COPY_VALIDACION.requerido("el origen")}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-destino">Destino <span className="text-destructive">*</span></Label>
        {maritimo ? (
          <PortSelect
            id="solicitud-destino"
            value={destino}
            onValueChange={(texto, puertoId) => setDestino(texto, puertoId)}
            placeholder={placeholderRuta(modo, "destino")}
            excludeId={puertoOrigenId}
            aria-invalid={errorDestino}
            aria-describedby={errorDestino ? "solicitud-destino-error" : undefined}
          />
        ) : (
          <Input id="solicitud-destino" value={destino} onChange={(e) => setDestino(e.target.value, null)}
            placeholder={placeholderRuta(modo, "destino")} aria-invalid={errorDestino}
            aria-describedby={errorDestino ? "solicitud-destino-error" : undefined} />
        )}
        {errorDestino && (
          <p id="solicitud-destino-error" role="alert" className="text-body-sm text-destructive">
            {COPY_VALIDACION.requerido("el destino")}
          </p>
        )}
      </div>
    </FormDialogSection>
  );
}
