/**
 * Tipos y helpers compartidos entre `conceptosFacturaCrud.ts` y
 * `recalcularTotalesFactura.ts`. Extraído para respetar el límite de 200
 * líneas por archivo (Power of 10).
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { TASA_IVA_FRONTERA_MX, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";

export type TipoIvaConcepto = TipoIvaSat;

/** Tasa de IVA de la región fronteriza (N17). */
export const TASA_IVA_FRONTERA = TASA_IVA_FRONTERA_MX;

export function resolverTasa(tipo: TipoIvaConcepto): number | null {
  if (tipo === "gravado_16") return TASA_IVA;
  if (tipo === "gravado_8") return TASA_IVA_FRONTERA;
  if (tipo === "tasa_0") return 0;
  return null; // exento y no_objeto (SAT ObjetoImp 01): sin tasa de traslado
}
