/**
 * Normalización canónica del UUID fiscal (Timbre Fiscal Digital del CFDI).
 *
 * El índice único de `proveedor_facturas` compara `upper(btrim(uuid_fiscal))`,
 * así que TODA búsqueda o guardado debe pasar por aquí para que la detección
 * de duplicados en la UI y la restricción de la base de datos coincidan.
 */

/** Devuelve el UUID sin espacios y en mayúsculas, o `null` si viene vacío. */
export function normalizarUuidFiscal(valor: string | null | undefined): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().toUpperCase();
  return limpio === "" ? null : limpio;
}

/** `true` si ambos UUID representan el mismo CFDI (ignora caja y espacios). */
export function mismoUuidFiscal(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarUuidFiscal(a);
  const nb = normalizarUuidFiscal(b);
  return na !== null && na === nb;
}
