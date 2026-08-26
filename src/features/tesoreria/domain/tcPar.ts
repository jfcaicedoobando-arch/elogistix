/**
 * Convención mexicana de captura de tipo de cambio para un par de divisas.
 *
 * En México se cotiza "cuántos pesos por 1 dólar" (18.42), nunca al revés.
 * Aquí elegimos siempre la divisa fuerte como base del par y expresamos la
 * cotización como `quote` unidades por 1 `base`, independientemente de la
 * dirección del traspaso.
 */

export type MonedaTc = "MXN" | "USD" | "EUR";

/** Fuerza relativa: la divisa con mayor rango es la base del par. */
const RANGO: Record<MonedaTc, number> = { EUR: 3, USD: 2, MXN: 1 };

export interface ParTc {
  base: MonedaTc;
  quote: MonedaTc;
}

/** Devuelve el par ordenado (base = divisa fuerte) o null si son iguales. */
export function parTc(origen?: string | null, destino?: string | null): ParTc | null {
  if (!esMonedaTc(origen) || !esMonedaTc(destino) || origen === destino) return null;
  return RANGO[origen] >= RANGO[destino]
    ? { base: origen, quote: destino }
    : { base: destino, quote: origen };
}

/**
 * Convierte la cotización capturada (`quote` por 1 `base`) al multiplicador
 * que la RPC espera: monto_destino = monto_origen * multiplicador.
 */
export function multiplicadorOrigenDestino(
  par: ParTc | null,
  origen: string | null | undefined,
  tcQuote: number,
): number | null {
  if (!par || !tcQuote || tcQuote <= 0) return null;
  if (origen === par.base) return tcQuote;
  if (origen === par.quote) return 1 / tcQuote;
  return null;
}

/** Etiqueta de captura, p. ej. "Tipo de cambio (MXN por 1 USD)". */
export function etiquetaTc(par: ParTc | null): string {
  if (!par) return "Tipo de cambio";
  return `Tipo de cambio (${par.quote} por 1 ${par.base})`;
}

function esMonedaTc(m: unknown): m is MonedaTc {
  return m === "MXN" || m === "USD" || m === "EUR";
}
