/**
 * Helpers para totalizar listas de conceptos en USD.
 * Pura conversión de moneda — sin React, sin formato.
 */

import { convertirAUSD, type Moneda } from "@/lib/financial/financialUtils";

interface MontoEnMoneda {
  monto: number;
  moneda: string;
}

/**
 * Suma una lista de montos convirtiéndolos a USD.
 * @param items - lista con campo `monto` y `moneda`
 * @param tcUSD - tipo de cambio MXN→USD
 * @param tcEUR - tipo de cambio MXN→EUR
 */
export function sumarEnUSD(
  items: MontoEnMoneda[],
  tcUSD: number,
  tcEUR: number,
): number {
  return items.reduce(
    (acc, item) => acc + convertirAUSD(item.monto, item.moneda as Moneda, tcUSD, tcEUR),
    0,
  );
}

/** Convierte un monto único a USD (wrapper conveniente). */
export function aUSD(monto: number, moneda: string, tcUSD: number, tcEUR: number): number {
  return convertirAUSD(monto, moneda as Moneda, tcUSD, tcEUR);
}
