/**
 * Aviso al usuario cuando el pago se guardó pero su movimiento bancario no
 * (v13.495.0). Antes esto fallaba en silencio y sólo quedaba la marca roja
 * "Movimiento no generado" en la bitácora.
 */
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { ResultadoMovimientoPago } from "./pagoProveedorMovimiento";

export function avisarMovimientoNoCreado(res: ResultadoMovimientoPago): boolean {
  if (res.ok) return true;
  notifyWarning(undefined, {
    title: "El pago se guardó, pero no se creó el movimiento en tesorería",
    description:
      "Usa “Regenerar movimiento” en la conciliación de tesorería de la factura para completarlo. " +
      (res.error ?? ""),
    duration: 10000,
  });
  return false;
}
