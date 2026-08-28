/**
 * Tipos y helpers compartidos entre `conceptosFacturaCrud.ts` y
 * `recalcularTotalesFactura.ts`. Extraído para respetar el límite de 200
 * líneas por archivo (Power of 10).
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";

export type TipoIvaConcepto = "gravado_16" | "gravado_8" | "tasa_0" | "exento";

/** Tasa de IVA de la región fronteriza (N17). */
export const TASA_IVA_FRONTERA = 0.08;

export function resolverTasa(tipo: TipoIvaConcepto): number | null {
  if (tipo === "gravado_16") return TASA_IVA;
  if (tipo === "gravado_8") return TASA_IVA_FRONTERA;
  if (tipo === "tasa_0") return 0;
  return null; // exento
}
