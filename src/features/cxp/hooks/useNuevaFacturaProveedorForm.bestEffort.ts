/**
 * Aviso compartido para fallos "best-effort" post-guardado de una factura de
 * proveedor: la factura ya quedó grabada pero un paso secundario (ajustes,
 * vínculos, concepto ad-hoc, XML) falló.
 *
 * Usa `persistent: true` para que el usuario alcance a leer y expone
 * "Ver detalles" con reporte copiable + breadcrumb Sentry.
 */
import { notifyWarning } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function notifyBestEffortFallo(titulo: string, err: unknown): void {
  notifyWarning(undefined, {
    title: titulo,
    description: getErrorMessage(err),
    persistent: true,
    error: err,
    method: "CXP_FACTURA_BEST_EFFORT_FALLO",
  });
}
