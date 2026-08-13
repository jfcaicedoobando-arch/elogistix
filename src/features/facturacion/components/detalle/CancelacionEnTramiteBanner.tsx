/**
 * CancelacionEnTramiteBanner (v13.592.0) — se muestra cuando la factura tiene
 * una solicitud de cancelación pendiente o en verificación ante el SAT.
 * Explica por qué el botón "Registrar pago" está deshabilitado.
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  /** `pending` (solicitud enviada) o `verifying` (en verificación). */
  estado: string;
}

export function CancelacionEnTramiteBanner({ estado }: Props) {
  const detalle =
    estado === "pending"
      ? "La solicitud de cancelación fue enviada al SAT."
      : "El SAT está verificando la cancelación.";
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Cancelación en trámite ante el SAT</AlertTitle>
      <AlertDescription>
        {detalle} Mientras la solicitud no se resuelva no se pueden registrar cobros de esta
        factura. Si el SAT rechaza la cancelación, la factura volverá a admitir pagos
        automáticamente.
      </AlertDescription>
    </Alert>
  );
}
