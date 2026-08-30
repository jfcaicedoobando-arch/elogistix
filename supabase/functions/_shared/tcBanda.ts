/**
 * OLA 2 · B) Banda canónica del tipo de cambio fiscal: 5..40 MXN por 1 divisa.
 *
 * Único criterio compartido por los endpoints de timbrado (facturas y notas de
 * crédito). Un T/C fuera de banda (1, 4.99, 40.01, NaN) es un dedazo y timbra
 * un CFDI con importes en MXN equivocados, que ya no se puede corregir sin
 * cancelar. MXN nunca requiere T/C.
 */
export const TC_MXN_MIN = 5;
export const TC_MXN_MAX = 40;

/** `true` si la moneda no requiere tipo de cambio. */
export function esMonedaNacional(moneda: string | null | undefined): boolean {
  return (moneda ?? "MXN") === "MXN";
}

/**
 * Devuelve `null` si el T/C es válido para la moneda, o un mensaje para el
 * usuario cuando debe bloquearse el timbrado.
 */
export function validarTcFiscal(
  moneda: string | null | undefined,
  tc: unknown,
): string | null {
  if (esMonedaNacional(moneda)) return null;
  const n = tc == null ? NaN : Number(tc);
  if (!Number.isFinite(n) || n < TC_MXN_MIN || n > TC_MXN_MAX) {
    return `Tipo de cambio inválido para ${moneda}: se esperan pesos por 1 divisa, entre ${TC_MXN_MIN} y ${TC_MXN_MAX} (DOF del día).`;
  }
  return null;
}
