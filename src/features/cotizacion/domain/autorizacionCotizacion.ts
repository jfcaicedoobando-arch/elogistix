/**
 * Estado visible de la autorización interna (espejo de `_cotizacion_autorizacion_guard`).
 */
import type { AppRole } from "@/types/appRole";

export type EstadoAutorizacion = "autorizada" | "por_autorizar" | "sin_solicitar" | "no_aplica";

const ROLES_AUTORIZADORES = new Set<string>(["admin", "admin_org", "gerente_comercial", "super_admin"]);
export const esAutorizadorCotizacion = (rol: AppRole | null | undefined) => !!rol && ROLES_AUTORIZADORES.has(rol);

export function estadoAutorizacion(c: {
  estado: string; autorizada_at?: string | null; autorizacion_solicitada_at?: string | null;
}): EstadoAutorizacion {
  if (c.autorizada_at) return "autorizada";
  if (c.estado !== "Borrador" && c.estado !== "Solicitada") return "no_aplica";
  return c.autorizacion_solicitada_at ? "por_autorizar" : "sin_solicitar";
}

/** Enviar o aceptar desde captura exige autorización vigente. */
export const requiereAutorizacionParaAvanzar = (estado: string, autorizadaAt?: string | null) =>
  (estado === "Borrador" || estado === "Solicitada") && !autorizadaAt;
