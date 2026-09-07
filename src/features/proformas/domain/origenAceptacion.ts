/**
 * Origen de la aceptación de una proforma (dominio puro).
 * Vive fuera del componente de badges para que el archivo de UI sólo exporte
 * componentes (regla react-refresh/only-export-components).
 */
export type OrigenAceptacion = "portal" | "manual" | "migracion" | "interna" | "desconocido";

/**
 * Deriva el origen de la aceptación a partir del campo `aceptada_por` que
 * escriben las RPCs (`manual:<email>`, `cliente_portal_token`,
 * `auto:sin_autorizacion_requerida`, o el string histórico de la migración
 * de julio 2026).
 */
export function derivarOrigenAceptacion(aceptadaPor: string | null | undefined): OrigenAceptacion {
  if (!aceptadaPor) return "desconocido";
  if (aceptadaPor === "cliente_portal_token") return "portal";
  // El cliente no requiere autorización de crédito: un miembro autorizado
  // aprobó la proforma internamente (RPC de aprobación interna).
  if (aceptadaPor === "auto:sin_autorizacion_requerida") return "interna";
  if (aceptadaPor.startsWith("manual:")) return "manual";
  const lower = aceptadaPor.toLowerCase();
  if (lower.includes("migración") || lower.includes("migracion")) return "migracion";
  return "desconocido";
}
