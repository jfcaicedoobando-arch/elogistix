/**
 * Mensajes centralizados de verificación de sesión / autenticación.
 *
 * Usar SIEMPRE estas constantes en lugar de literales sueltos para que los
 * tests no dependan del texto exacto y los mensajes sean consistentes en toda
 * la aplicación (es-MX).
 */
export const AUTH_ERROR_MESSAGES = {
  /** Falta sesión activa para una operación específica (parametrizable). */
  sessionRequired: (accion: string) =>
    `Debes iniciar sesión para ${accion}`,
  /** No se pudo revalidar la sesión en ese momento (rotación/red), pero el
   *  usuario sí está dentro de la aplicación: pedir reintento, no relogin. */
  sessionRefreshFailed:
    "No pudimos validar tu sesión en este momento. Intenta de nuevo en unos segundos.",
  /** Sesión genérica no válida / expirada. */
  invalidSession: "Sesión no válida",
  /** Usuario no autenticado en endpoints del portal. */
  notAuthenticated: "No autenticado",
  /** Acción específica: procesar la Constancia de Situación Fiscal. */
  csfSessionRequired: "Debes iniciar sesión para procesar la Constancia de Situación Fiscal",
} as const;
