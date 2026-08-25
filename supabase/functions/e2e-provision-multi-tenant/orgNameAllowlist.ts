// Allowlist estricta de nombres de organizaciones que `e2e-provision-multi-tenant`
// puede provisionar/limpiar (bug-hunt ronda 2 · P3).
//
// Antes, el cleanup borraba con service_role CUALQUIER org cuyo `nombre`
// llegara en el payload: si `E2E_PROVISION_SECRET` se filtraba, el atacante
// podía borrar orgs reales con sólo conocer su nombre (o peor: `provisionOne`
// hacía upsert por nombre y adjuntaba datos/admin E2E a una org real homónima).
// Ahora el nombre debe tener un prefijo de test reconocible, igual que la
// allowlist A9 de emails de `e2e-provision-users`.
//
// Módulo puro (sin APIs de Deno) para poder probarlo con Vitest.

/**
 * Prefijos de nombres de org permitidos cuando no se configura allowlist
 * explícita. Deben ir seguidos de un separador (espacio, guion o underscore)
 * para que "Testers Unidos" o "E2Ecommerce SA" NO pasen.
 */
export const PREFIJOS_ORG_E2E_POR_DEFECTO = ["e2e", "test"];

/**
 * Normaliza la allowlist configurada (`E2E_PROVISION_ORG_ALLOWLIST`):
 * prefijos adicionales separados por coma, punto y coma o salto de línea.
 */
export function parseOrgAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

function tienePrefijoConSeparador(nombre: string, prefijo: string): boolean {
  if (!nombre.startsWith(prefijo)) return false;
  // Prefijo que ya incluye separador final (p.ej. "e2e-" desde la allowlist).
  if (/[\s\-_]$/.test(prefijo)) return nombre.length > prefijo.length;
  const siguiente = nombre.charAt(prefijo.length);
  return siguiente === " " || siguiente === "-" || siguiente === "_";
}

/**
 * ¿El nombre de org puede provisionarse/limpiarse por la suite E2E? Reglas:
 * 1. Si hay allowlist configurada, sólo pasan nombres con esos prefijos.
 * 2. Sin allowlist, sólo pasan los prefijos de prueba por defecto
 *    (`E2E …` / `TEST …`, con separador).
 */
export function nombreOrgPermitido(
  nombre: string,
  allowlistRaw?: string | null,
): boolean {
  const target = (nombre ?? "").trim().toLowerCase();
  if (!target) return false;

  const prefijos = parseOrgAllowlist(allowlistRaw);
  const candidatos = prefijos.length > 0 ? prefijos : PREFIJOS_ORG_E2E_POR_DEFECTO;
  return candidatos.some((prefijo) => tienePrefijoConSeparador(target, prefijo));
}

/**
 * Devuelve el primer nombre rechazado, o `null` si todos están permitidos
 * (los vacíos/undefined se ignoran — el caller los salta de todos modos).
 */
export function primerNombreOrgNoPermitido(
  nombres: (string | undefined | null)[],
  allowlistRaw?: string | null,
): string | null {
  for (const nombre of nombres) {
    if (!nombre) continue;
    if (!nombreOrgPermitido(nombre, allowlistRaw)) return nombre;
  }
  return null;
}
