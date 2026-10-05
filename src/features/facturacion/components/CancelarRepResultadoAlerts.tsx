/**
 * Alertas de resultado de la cancelación de un REP ante el SAT.
 * Se extrajo de `DialogCancelarRep` para mantener cada archivo por debajo del
 * límite de 200 líneas del estándar del proyecto. Los mensajes son los mismos:
 * aceptada, aceptada con fallo de sincronización local, en verificación
 * (pending/uncertain) y error.
 */
import { CheckCircle2, Clock3, CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ResultadoCancelacionRep } from "@/features/facturacion/hooks/useCancelarRepController";

export function CancelarRepResultadoAlerts({ resultado }: { resultado: ResultadoCancelacionRep }) {
  if (resultado === "accepted") {
    return (
      <Alert variant="success">
        <CheckCircle2 className="size-4" />
        <AlertDescription>
          REP cancelado. Se dio de baja su cobro y se recalculó el saldo de la factura,
          conservando los demás abonos y créditos. Esto no devuelve dinero en el banco.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "accepted_sync_failed") {
    return (
      <Alert variant="destructive">
        <CircleAlert className="size-4" />
        <AlertDescription>
          El SAT aceptó la cancelación del REP, pero no se pudo dar de baja su cobro en el ERP.
          Revisa el error y actualiza el estado. Si el cobro sigue registrado y la cancelación
          está confirmada, completa su baja para recalcular el saldo y sus vínculos bancarios.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "pending" || resultado === "uncertain") {
    return (
      <Alert variant="warning">
        <Clock3 className="size-4" />
        <AlertDescription>
          {resultado === "pending"
            ? "La solicitud de cancelación sigue pendiente."
            : "Aún no se pudo confirmar el resultado fiscal de la cancelación."}
          {" "}El cobro se conserva en el ERP hasta contar con una respuesta definitiva.
          Usa "Actualizar estado"; si el REP aparece como "Cancelado" y el cobro sigue
          registrado, completa su baja sin registrar otro cobro.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "error") {
    return (
      <Alert variant="destructive">
        <CircleAlert className="size-4" />
        <AlertDescription>
          No se pudo completar la cancelación. Revisa el mensaje de error; si el REP ya fue
          cancelado previamente, usa "Actualizar estado" desde el detalle.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
