/**
 * M-14 · Banda de plausibilidad del tipo de cambio.
 *
 * Convención única del sistema: MXN por 1 unidad de divisa (pesos por dólar).
 * Un T/C fuera de la banda casi siempre es un dedazo (18 → 1.8 o 180) y
 * contamina totales en MXN, P&L y conciliaciones. La banda es intencionalmente
 * ancha: sólo atrapa errores de captura, no fluctuaciones de mercado.
 */
export const TC_MXN_MIN = 5;
export const TC_MXN_MAX = 40;

/** `true` cuando el par incluye MXN y por tanto aplica la banda. */
export function parInvolucraMxn(a?: string | null, b?: string | null): boolean {
  return a === "MXN" || b === "MXN";
}

/**
 * Devuelve un mensaje para el usuario cuando el T/C está fuera de banda, o
 * `null` si es plausible. `tc` se interpreta como MXN por 1 divisa.
 */
export function validarTcMxn(tc: number | null | undefined): string | null {
  if (!tc || tc <= 0) return null; // "sin capturar" lo valida cada formulario.
  if (tc < TC_MXN_MIN || tc > TC_MXN_MAX) {
    return `El tipo de cambio (${tc}) parece incorrecto. Se espera pesos por 1 divisa, entre ${TC_MXN_MIN} y ${TC_MXN_MAX}.`;
  }
  return null;
}
