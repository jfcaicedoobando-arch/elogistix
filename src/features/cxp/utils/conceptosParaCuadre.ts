/**
 * Fuente de verdad de las partidas que alimentan el cuadre contra el subtotal:
 * CFDI > conceptos manuales (Q-02) > montos vinculados a embarques.
 * Extraído en v13.366.0 para respetar Power of 10 #1 (≤200 líneas).
 */
import type { ConceptoParaCuadre } from "@/features/cxp/utils/cuadreConceptos";

export function resolverConceptosParaCuadre(
  cfdi: ReadonlyArray<{ importe?: number | string | null; cantidad?: number | null }>,
  manuales: ReadonlyArray<{ importe?: number | string | null; cantidad?: number | null }>,
  vinculos: Record<string, { monto?: number | string | null }>,
): ConceptoParaCuadre[] {
  const fuente = cfdi.length > 0 ? cfdi : manuales;
  if (fuente.length > 0) {
    return fuente.map((c) => ({ monto: Number(c.importe) || 0, cantidad: c.cantidad }));
  }
  return Object.values(vinculos).map((v) => ({ monto: Number(v.monto) || 0 }));
}

/**
 * IVA desglosado en las partidas que el usuario realmente está viendo, con la
 * MISMA prelación de fuentes que `resolverConceptosParaCuadre` (CFDI > manuales).
 * Antes sólo se sumaba el IVA del CFDI, así que una captura manual con IVA por
 * renglón se reportaba como "IVA no desglosado por partida". Los montos
 * vinculados a embarques no llevan IVA: ahí el desglose es 0 por definición.
 */
export function sumarIvaPartidasVisibles(
  cfdi: ReadonlyArray<{ iva?: number | string | null }>,
  manuales: ReadonlyArray<{ iva?: number | string | null }>,
): number {
  const fuente = cfdi.length > 0 ? cfdi : manuales;
  return fuente.reduce((acc, c) => acc + (Number(c.iva) || 0), 0);
}
