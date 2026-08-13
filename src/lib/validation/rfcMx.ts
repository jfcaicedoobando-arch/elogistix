/**
 * Validación compartida de RFC mexicano (patrón SAT).
 *
 * - Persona moral:  3 letras + 6 dígitos (AAMMDD) + 3 alfanuméricos = 12.
 * - Persona física: 4 letras + 6 dígitos (AAMMDD) + 3 alfanuméricos = 13.
 *
 * Es el único origen de verdad en el frontend; la base de datos replica la
 * misma regla en `public._rfc_valido`.
 */

export const RFC_MX_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

/** RFC genéricos del SAT (público en general / residente en el extranjero). */
export const RFC_GENERICOS = ["XAXX010101000", "XEXX010101000"] as const;

/** Normaliza a mayúsculas sin espacios alrededor. */
export function normalizarRfc(rfc: string | null | undefined): string {
  return (rfc ?? "").trim().toUpperCase();
}

export function esRfcGenerico(rfc: string | null | undefined): boolean {
  const v = normalizarRfc(rfc);
  return (RFC_GENERICOS as readonly string[]).includes(v);
}

/**
 * `true` cuando el RFC cumple el patrón SAT.
 * Por omisión se aceptan los genéricos; para facturación nominativa
 * (refacturación) pasa `permitirGenerico: false`.
 */
export function esRfcMxValido(
  rfc: string | null | undefined,
  opciones?: { permitirGenerico?: boolean },
): boolean {
  const v = normalizarRfc(rfc);
  if (v === "") return false;
  if (opciones?.permitirGenerico === false && esRfcGenerico(v)) return false;
  return RFC_MX_RE.test(v);
}
