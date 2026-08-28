import { type Moneda } from "@/lib/financial/financialUtils";
import { sumarEnMxn } from "@/lib/financial/convertir";

/**
 * Suma una colección de conceptos convirtiendo a MXN según moneda y TC del embarque.
 * FIX C6: los montos en moneda extranjera sin TC válido se excluyen en lugar de
 * sumarse como si fueran pesos.
 */
export function sumarConceptosEnMxn(
  conceptos: { monto: number; moneda: string }[],
  tcUsd: number,
  tcEur: number,
): number {
  return sumarEnMxn(conceptos, (c) => ({ monto: c.monto, moneda: c.moneda }), {
    usd: tcUsd, eur: tcEur,
  }).total;
}


/** Suma una colección de conceptos convirtiendo a USD según moneda y TC del embarque.
 *  MXN → /tcUsd · EUR → *tcEur/tcUsd · USD → tal cual.
 *
 *  Auditoría 2026-08-28 · Hallazgo 5: antes, con `tcUsd` inválido se devolvía 0
 *  para TODO el conjunto (el KPI en USD se caía a cero en silencio). Ahora se
 *  excluye únicamente lo que no se puede convertir, igual que el canon
 *  `sumarEnMxn`. */
export function sumarConceptosEnUsd(
  conceptos: { monto: number; moneda: string }[],
  tcUsd: number,
  tcEur: number,
): number {
  const usdValido = Number.isFinite(tcUsd) && tcUsd > 0;
  const eurValido = Number.isFinite(tcEur) && tcEur > 0;
  return conceptos.reduce((acc, c) => {
    const moneda = (c.moneda?.toUpperCase() ?? "MXN") as Moneda;
    if (moneda === "USD") return acc + c.monto;
    if (!usdValido) return acc; // sin TC no se inventa la conversión
    if (moneda === "EUR") return eurValido ? acc + (c.monto * tcEur) / tcUsd : acc;
    return acc + c.monto / tcUsd; // MXN
  }, 0);
}
