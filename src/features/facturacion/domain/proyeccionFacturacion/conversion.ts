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
 *  MXN → /tcUsd · EUR → *tcEur/tcUsd · USD → tal cual. */
export function sumarConceptosEnUsd(
  conceptos: { monto: number; moneda: string }[],
  tcUsd: number,
  tcEur: number,
): number {
  if (!tcUsd || tcUsd <= 0) return 0;
  return conceptos.reduce((acc, c) => {
    const moneda = (c.moneda?.toUpperCase() ?? "MXN") as Moneda;
    if (moneda === "USD") return acc + c.monto;
    if (moneda === "EUR") return acc + (c.monto * tcEur) / tcUsd;
    return acc + c.monto / tcUsd; // MXN
  }, 0);
}
