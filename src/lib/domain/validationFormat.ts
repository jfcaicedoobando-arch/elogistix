/**
 * Helper de formato unificado para mensajes de validación.
 * Patrón estándar: "Campo: razón." (punto final garantizado).
 *
 * Vive en su propio módulo para evitar ciclos de import entre
 * `errorCatalog.ts` y `embarqueWizardSchemas.ts`.
 */
export function formatValidationMessage(field: string, reason: string): string {
  const cleanReason = reason.trim().replace(/[.!]+$/u, "");
  return `${field.trim()}: ${cleanReason}.`;
}
