/**
 * Validación del número de contenedor según el estándar ISO 6346.
 *
 * Formato: 4 letras mayúsculas (código de propietario + U/J/Z) seguidas de
 * 7 dígitos (número de serie + dígito verificador). Ejemplo: `MSCU1234567`.
 *
 * El vacío es válido: representa "aún no se asignó número al contenedor".
 * La validación del dígito verificador (checksum) se deja fuera para no
 * bloquear captura anticipada; sólo se valida forma.
 */

export const ISO6346_REGEX = /^[A-Z]{4}[0-9]{7}$/;

export const ISO6346_MENSAJE =
  "Formato ISO 6346: 4 letras + 7 dígitos (ej. MSCU1234567). Déjalo vacío si aún no lo asignan.";

/** Normaliza para captura: quita espacios y sube a mayúsculas. */
export function normalizarNumeroContenedor(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** True si está vacío o cumple el patrón ISO 6346. */
export function esNumeroContenedorValido(valor: string | null | undefined): boolean {
  const v = (valor ?? "").trim();
  if (v === "") return true;
  return ISO6346_REGEX.test(v);
}
