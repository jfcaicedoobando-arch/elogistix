/**
 * 13.823.281 — Detección de cotización mixta (conceptos con importe en USD y en MXN).
 *
 * Pricing también requiere TC si una única bolsa difiere de su cabecera fija.
 * No convierte importes ni toca el IVA.
 */
import { importeVentaSinIva } from "./importeVentaSinIva";

export interface ConceptoConTotal {
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal?: number | null;
  total?: number | null;
}

function sumaPositiva(conceptos: ReadonlyArray<ConceptoConTotal>): number {
  return conceptos.reduce((s, c) => s + (Number(c?.total) || 0), 0);
}

export function hayMezclaDeMonedas(
  conceptosUSD: ReadonlyArray<ConceptoConTotal>,
  conceptosMXN: ReadonlyArray<ConceptoConTotal>,
): boolean {
  return sumaPositiva(conceptosUSD) > 0 && sumaPositiva(conceptosMXN) > 0;
}


/** El encabezado Pricing queda fijo aunque haya una sola divisa de venta. */
export function requiereTipoCambioCotizacion(
  conceptosUSD: ReadonlyArray<ConceptoConTotal>,
  conceptosMXN: ReadonlyArray<ConceptoConTotal>,
  monedaCanonica?: string | null,
): boolean {
  if (monedaCanonica === "MXN") return conceptosUSD.some((c) => importeVentaSinIva(c) > 0);
  if (monedaCanonica === "USD") return conceptosMXN.some((c) => importeVentaSinIva(c) > 0);
  return hayMezclaDeMonedas(conceptosUSD, conceptosMXN);
}
