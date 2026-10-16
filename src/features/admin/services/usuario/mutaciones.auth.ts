/**
 * Helpers de sesión compartidos por las mutaciones de usuarios.
 * Extraído para respetar el límite de 200 líneas (Power of 10).
 */
/** URL de retorno para invitaciones/restablecimientos (segura en entorno node). */
export function resetRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/reset-password`;
}
