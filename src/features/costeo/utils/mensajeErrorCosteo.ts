import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
import { mensajeConstraintUnico } from "@/lib/errors/pgConstraintMessages";

export const MSG_REINTENTAR = "Intenta de nuevo. Si el problema sigue, avisa a soporte.";

/**
 * Texto del toast de error en Costeo. Las reglas de negocio que lanzan los
 * servicios (ruta duplicada, monedas mezcladas, ruta con tarifas…) ya traen
 * un mensaje en español que dice cómo arreglarlo: se muestra tal cual. Sólo
 * los errores técnicos de la base se ocultan tras el mensaje genérico.
 */
export function mensajeErrorCosteo(e: Error): string {
  if (e instanceof ReglaNegocioError) return e.message;
  return mensajeConstraintUnico(e.message) ?? MSG_REINTENTAR;
}
