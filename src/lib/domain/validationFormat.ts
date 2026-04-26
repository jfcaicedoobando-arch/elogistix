/**
 * Helper neutro para formatear mensajes de validación al patrón estándar:
 *   "Campo: razón."
 *
 * Vive en su propio módulo para evitar ciclos de import entre el catálogo de
 * mensajes (`errorCatalog.ts`) y los schemas de dominio que lo consumen.
 */
export function formatValidationMessage(field: string, reason: string): string {
  const cleanReason = reason.trim().replace(/[.!]+$/u, "");
  return `${field.trim()}: ${cleanReason}.`;
}
