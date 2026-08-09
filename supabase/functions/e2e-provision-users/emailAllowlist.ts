// A9 (v13.469.0) — Allowlist de cuentas provisionables por la suite E2E.
//
// Antes, con el secreto correcto se podía resetear la contraseña de CUALQUIER
// usuario (incluido un super admin de producción) y darle rol `admin`. Ahora el
// email objetivo debe estar explícitamente permitido.
//
// Módulo puro (sin APIs de Deno) para poder probarlo con Vitest.

/** Dominios de prueba permitidos cuando no se configura allowlist explícita. */
export const DOMINIOS_E2E_POR_DEFECTO = [
  "e2e.librecarga.test",
  "e2e.local",
  "example.com",
  "test.local",
  "mailinator.com",
];

/**
 * Normaliza la allowlist configurada (`E2E_PROVISION_EMAIL_ALLOWLIST`).
 * Acepta emails completos (`qa.admin@empresa.com`) y dominios (`@e2e.local`
 * o `e2e.local`), separados por coma, punto y coma o espacios.
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

function dominioDe(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1);
}

/**
 * ¿El email puede provisionarse? Reglas (en orden):
 * 1. Si hay allowlist configurada, sólo pasan sus emails/dominios.
 * 2. Sin allowlist, sólo pasan los dominios de prueba por defecto.
 */
export function emailPermitido(
  email: string,
  allowlistRaw?: string | null,
): boolean {
  const target = (email ?? "").trim().toLowerCase();
  if (!target || !target.includes("@")) return false;

  const dominio = dominioDe(target);
  if (!dominio) return false;

  const allowlist = parseAllowlist(allowlistRaw);
  if (allowlist.length > 0) {
    return allowlist.some((entry) => {
      // "@dominio.com" o "dominio.com" = regla de dominio;
      // "persona@dominio.com" = regla de email exacto.
      if (entry.startsWith("@")) return entry.slice(1) === dominio;
      if (!entry.includes("@")) return entry === dominio;
      return entry === target;
    });
  }

  return DOMINIOS_E2E_POR_DEFECTO.includes(dominio);
}

/** Devuelve el primer email rechazado, o `null` si todos están permitidos. */
export function primerEmailNoPermitido(
  emails: (string | undefined | null)[],
  allowlistRaw?: string | null,
): string | null {
  for (const email of emails) {
    if (!email) continue;
    if (!emailPermitido(email, allowlistRaw)) return email;
  }
  return null;
}
