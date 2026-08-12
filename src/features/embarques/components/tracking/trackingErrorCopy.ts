/**
 * UIB-06: la edge `tracking-public` devuelve códigos técnicos en `body.error`
 * (p.ej. `edge_functions_unavailable`). Nunca mostrarlos crudos al destinatario
 * externo del tracking.
 */
export function mensajeTrackingAmigable(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (
    !m ||
    m.includes("invalid") ||
    m.includes("expired") ||
    m.includes("not found") ||
    m.includes("token")
  ) {
    return "Este enlace de tracking no existe o ha expirado.";
  }
  return "El servicio de seguimiento no está disponible en este momento. Intenta de nuevo en unos minutos.";
}
