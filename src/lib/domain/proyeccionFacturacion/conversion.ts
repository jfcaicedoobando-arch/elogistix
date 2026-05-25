import { convertirAMXN, type Moneda } from "@/lib/financial/financialUtils";

/** Suma una colección de conceptos convirtiendo a MXN según moneda y TC del embarque. */
export function sumarConceptosEnMxn(
  conceptos: { monto: number; moneda: string }[],
  tcUsd: number,
  tcEur: number,
): number {
  return conceptos.reduce((acc, c) => {
    const moneda = (c.moneda?.toUpperCase() ?? "MXN") as Moneda;
    return acc + convertirAMXN(c.monto, moneda, tcUsd, tcEur);
  }, 0);
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
