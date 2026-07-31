/**
 * P1-3 — Formateo defensivo del UUID fiscal devuelto por el PAC.
 *
 * El tipo declara `uuid: string`, pero en producción el PAC puede responder
 * sin UUID (timbrado aceptado con acuse parcial, respuesta truncada por el
 * proxy). Acceder directo con `.slice(0,8)` reventaba el `onSuccess` con
 * `TypeError: Cannot read properties of undefined (reading 'slice')` y el
 * usuario veía un error aunque la factura sí quedó timbrada.
 */

/** Devuelve `UUID abcd1234…` o `null` si el PAC no regresó UUID. */
export function uuidCorto(uuid: string | null | undefined): string | null {
  const limpio = typeof uuid === "string" ? uuid.trim() : "";
  if (!limpio) return null;
  return `${limpio.slice(0, 8)}…`;
}

/**
 * Título de toast de éxito de timbrado. Si no hay UUID, se omite el sufijo en
 * lugar de fallar: el documento ya está timbrado.
 */
export function tituloTimbrado(base: string, uuid: string | null | undefined): string {
  const corto = uuidCorto(uuid);
  return corto ? `${base} · UUID ${corto}` : base;
}
