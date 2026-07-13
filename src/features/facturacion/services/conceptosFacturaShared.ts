/**
 * Tipos y helpers compartidos entre `conceptosFacturaCrud.ts` y
 * `recalcularTotalesFactura.ts`. Extraído para respetar el límite de 200
 * líneas por archivo (Power of 10).
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";

export type TipoIvaConcepto = "gravado_16" | "tasa_0" | "exento";

export function resolverTasa(tipo: TipoIvaConcepto): number | null {
  if (tipo === "gravado_16") return TASA_IVA;
  if (tipo === "tasa_0") return 0;
  return null; // exento
}
