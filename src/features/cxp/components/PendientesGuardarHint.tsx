/**
 * Lista corta de pendientes junto al botón "Guardar factura".
 * La derivación de pendientes vive en `pendientesDeCaptura.ts`.
 */
import { AlertCircle } from "lucide-react";
import {
  pendientesDeCaptura,
  type PendientesCapturaArgs,
} from "@/features/cxp/components/pendientesDeCaptura";

export function PendientesGuardarHint(props: PendientesCapturaArgs) {
  const faltan = pendientesDeCaptura(props);
  if (faltan.length === 0) return null;

  return (
    <p
      className="mr-auto flex items-start gap-1.5 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span>{faltan.join(" · ")}</span>
    </p>
  );
}
