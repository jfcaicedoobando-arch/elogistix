/**
 * UIB-06: la edge `tracking-public` devuelve códigos técnicos en `body.error`
 * (p.ej. `edge_functions_unavailable`). Nunca mostrarlos crudos al destinatario
 * externo del tracking: se traducen al copy público único (`publicoCopy`).
 *
 * RUX-02: la edge devuelve además `body.code` estable (`token_required`,
 * `not_found`, `expired`, `unavailable`) y `fetchTrackingPublico` lo propaga
 * como `error.message`. Se matchea por código/estructura; los literales en
 * inglés y español quedan sólo como red de compatibilidad con despliegues
 * viejos de la edge.
 */
import { COPY_ENLACE } from "@/lib/copy/publicoCopy";

export function mensajeTrackingAmigable(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (
    !m ||
    // Códigos estables de la edge (RUX-02).
    m.includes("token_required") ||
    m.includes("not_found") ||
    m === "expired" ||
    // Literales heredados (en/es) — compatibilidad hacia atrás.
    m.includes("invalid") ||
    m.includes("token") ||
    m.includes("not found") ||
    m.includes("no encontrado") ||
    m.includes("expirado")
  ) {
    return COPY_ENLACE.invalido;
  }
  return COPY_ENLACE.noDisponible;
}
