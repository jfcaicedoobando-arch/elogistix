/**
 * R3 · P3 — Enmascarado de PII para logs de edge functions.
 *
 * Los correos completos no deben escribirse en logs (Supabase/Sentry tienen
 * retención y accesos distintos a los de la app). Se conserva la primera
 * letra del local-part y el dominio para poder correlacionar sin exponer la
 * dirección: `j***@ejemplo.com`.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "(sin-email)";
  const limpio = email.trim();
  const at = limpio.indexOf("@");
  if (at <= 0 || at === limpio.length - 1) return "***";
  const local = limpio.slice(0, at);
  const dominio = limpio.slice(at + 1);
  return `${local[0]}***@${dominio}`;
}

/** Enmascara todos los correos que aparezcan dentro de un texto libre. */
export function maskEmailsInText(text: string): string {
  return text.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => maskEmail(m));
}
