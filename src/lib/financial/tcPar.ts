/**
 * Convención mexicana de captura de tipo de cambio para un par de divisas.
 *
 * En México se cotiza "cuántos pesos por 1 dólar" (18.42), nunca al revés.
 * Aquí elegimos siempre la divisa fuerte como base del par y expresamos la
 * cotización como `quote` unidades por 1 `base`, independientemente de la
 * dirección de la operación (traspaso, pago, factura).
 *
 * v13.751.1 — movido desde `features/tesoreria/domain/tcPar.ts` para
 * homologar la etiqueta en todo el ERP (facturación, CxP, tesorería).
 */

import type { Moneda } from "@/types/db";

/** Alias local del catálogo central de monedas (`@/types/db`). */
export type MonedaTc = Moneda;

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

/**
 * Etiqueta para una divisa extranjera contra pesos, p. ej.
 * "Tipo de cambio (MXN por 1 USD)". Con MXN (o vacío) devuelve el genérico.
 */
export function etiquetaTcContraMxn(moneda?: string | null): string {
  return etiquetaTc(parTc(moneda, "MXN"));
}

/** Texto de ayuda bajo el input, p. ej. "Pesos que se pagan por 1 USD". */
export function ayudaTcContraMxn(moneda?: string | null): string | null {
  const par = parTc(moneda, "MXN");
  if (!par || par.quote !== "MXN") return null;
  return `Pesos que se pagan por 1 ${par.base}.`;
}

/** Placeholder realista para que se vea la magnitud esperada (~18.42). */
export const TC_PLACEHOLDER_MXN = "18.4200";

function esMonedaTc(m: unknown): m is MonedaTc {
  return m === "MXN" || m === "USD" || m === "EUR";
}
