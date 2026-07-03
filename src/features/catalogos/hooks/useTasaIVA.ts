import { TASA_IVA } from "@/lib/financial/financialUtils";

/**
 * Tasa de IVA general aplicable en México (16%).
 *
 * Se mantiene como hook (no como constante importada directamente) para
 * preservar la firma histórica de sus ~15 consumidores (cotización, proforma,
 * factura, PDFs) y para permitir a futuro re-cablearlo si México introduce
 * regímenes distintos (frontera, etc.).
 *
 * Desde 13.170.0 ya no lee de `configuracion.tasa_iva`: el IVA por concepto
 * viaja en el catálogo de productos (`catalogo_claves_sat.tipo_iva`).
 */
export function useTasaIVA(): number {
  return TASA_IVA;
}
