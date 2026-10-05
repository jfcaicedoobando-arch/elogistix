import type { FlujoMes } from "./resumen.types";

export interface RenglonFlujoMoneda {
  moneda: string;
  cobrar: number;
  pagar: number;
  neto: number;
}

/** Fuente común de la tabla y PDF: importes nominales, nunca suma entre monedas. */
export function renglonesFlujoMonedas(flujo: FlujoMes): RenglonFlujoMoneda[] {
  return [
    { moneda: "MXN", cobrar: flujo.por_cobrar_mxn ?? 0, pagar: flujo.por_pagar_mxn ?? 0 },
    { moneda: "USD", cobrar: flujo.por_cobrar_usd ?? 0, pagar: flujo.por_pagar_usd ?? 0 },
    { moneda: "EUR", cobrar: flujo.por_cobrar_eur ?? 0, pagar: flujo.por_pagar_eur ?? 0 },
  ].filter((r) => r.moneda !== "EUR" || r.cobrar !== 0 || r.pagar !== 0)
    .map((r) => ({ ...r, neto: r.cobrar - r.pagar }));
}
