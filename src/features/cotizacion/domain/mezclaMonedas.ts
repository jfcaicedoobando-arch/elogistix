/**
 * 13.823.281 — Detección de cotización mixta (conceptos con importe en USD y en MXN).
 *
 * Es el único disparador del tipo de cambio de la cotización: sólo cuando hay
 * dinero en ambas monedas el encabezado necesita convertir para expresar un
 * subtotal único. No convierte importes ni toca el IVA.
 */
export interface ConceptoConTotal {
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
