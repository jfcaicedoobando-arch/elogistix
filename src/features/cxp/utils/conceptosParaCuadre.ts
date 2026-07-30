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
