/**
 * Helpers puros para `preview-transactional-email` — extraídos para testabilidad.
 */

/** Valida el header `Authorization: Bearer <apiKey>` contra el secreto del entorno. */
export function isAuthorized(authHeader: string | null, apiKey: string): boolean {
  if (!apiKey) return false
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  return token === apiKey
}

/** Resuelve el subject de un template (string o función con previewData). */
export function resolveSubject(
  subject: string | ((data: Record<string, unknown>) => string),
  previewData: Record<string, unknown>,
): string {
  return typeof subject === 'function' ? subject(previewData) : subject
}
