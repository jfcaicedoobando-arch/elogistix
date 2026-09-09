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
          Cancelación aceptada. El pago fue eliminado y el saldo de la factura se recalculó.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "accepted_sync_failed") {
    return (
      <Alert variant="destructive">
        <CircleAlert className="size-4" />
        <AlertDescription>
          El SAT aceptó la cancelación del REP, pero no se pudo eliminar el pago local.
          Revisa el mensaje de error. Si el pago aún existe, elimínalo manualmente para que
          la factura vuelva a reflejar saldo pendiente.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "pending" || resultado === "uncertain") {
    return (
      <Alert variant="warning">
        <Clock3 className="size-4" />
        <AlertDescription>
          El SAT está verificando la cancelación. El pago no se eliminó todavía porque la
          respuesta fiscal aún no es definitiva. Cuando el estado cambie a "Cancelado",
          vuelve a intentar la cancelación o elimina el pago manualmente si ya tienes
          constancia del SAT.
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
