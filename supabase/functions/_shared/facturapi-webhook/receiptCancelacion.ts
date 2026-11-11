/**
 * P1 · FacturAPI 5.0 — `receipt.cancellation_status_updated` (y su equivalente
 * `invoice.cancellation_status_updated` cuando FacturAPI reporta el complemento
 * como invoice) hacia `public.pagos_factura`.
 *
 * Espejo de `mapCancellationStatusUpdated` (rama de facturas): `accepted` es
 * TERMINAL y cierra `estado_rep`; el resto sólo reporta el estado asíncrono del
 * SAT. El guard de orden vive en el handler: un evento atrasado
 * (pending/verifying) nunca revierte un `accepted` ya persistido.
 *
 * Extraído de `helpers.ts` para respetar el límite de líneas por archivo.
 */
import type { MappedReceiptUpdate } from "./helpers.ts";

export function mapReceiptCancellationStatus(
  facturapi_rep_id: string,
  cancellationStatus: string | null,
): MappedReceiptUpdate | null {
  if (!cancellationStatus) return null;
  const patch: Record<string, unknown> = { rep_cancellation_status: cancellationStatus };
  if (cancellationStatus === "accepted") {
    patch.estado_rep = "Cancelado";
    patch.rep_cancelado_en = new Date().toISOString();
  }
  return { facturapi_rep_id, patch, bitacora_accion: "facturapi_webhook_rep_cancellation_status" };
}
