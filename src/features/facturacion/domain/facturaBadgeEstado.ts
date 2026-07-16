/**
 * Deriva el estado "visual" de una factura combinando el estado de BD con
 * el estado del acuse de cancelación del SAT.
 *
 * Motivación: cuando disparamos la cancelación contra FacturAPI, marcamos
 * `estado = 'Cancelada'` inmediatamente pero el SAT puede tardar en
 * responder al aceptar/rechazar la cancelación. Durante ese lapso mostrar
 * "Cancelada" (rojo) es engañoso — debe verse como "En cancelación" (ámbar).
 */
export function deriveFacturaBadgeEstado(
  estado: string | null | undefined,
  acuseStatus: string | null | undefined,
): string {
  const e = (estado ?? "").trim();
  const a = (acuseStatus ?? "").trim().toLowerCase();
  if (e === "Cancelada" && a && a !== "accepted") {
    // 'pending', 'in_progress' o cualquier otro no aceptado → aún en trámite.
    return "En cancelación";
  }
  return e;
}
