/**
 * Deriva el estado "visual" de una factura combinando el estado de BD con
 * el estado del acuse de cancelación del SAT y el flag `cancellation_status`
 * que refleja el trámite en vivo contra FacturAPI.
 *
 * Reglas:
 * - Si BD dice `Cancelada` pero el acuse aún no está `accepted` → "En cancelación".
 * - Si BD dice `Emitida` pero hay una solicitud viva en FacturAPI
 *   (`cancellation_status` = `pending` | `verifying`) → "En cancelación".
 * - En cualquier otro caso, se muestra el estado tal cual.
 */
export function deriveFacturaBadgeEstado(
  estado: string | null | undefined,
  acuseStatus: string | null | undefined,
  cancellationStatus: string | null | undefined = null,
): string {
  const e = (estado ?? "").trim();
  const a = (acuseStatus ?? "").trim().toLowerCase();
  const cs = (cancellationStatus ?? "").trim().toLowerCase();
  if (e === "Cancelada" && a && a !== "accepted") {
    // 'pending', 'in_progress' o cualquier otro no aceptado → aún en trámite.
    return "En cancelación";
  }
  if (e === "Emitida" && (cs === "pending" || cs === "verifying")) {
    return "En cancelación";
  }
  return e;
}
