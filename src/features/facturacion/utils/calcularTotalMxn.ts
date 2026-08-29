import { aMxn } from "@/lib/financial/convertir";
import { calcularTotalesConceptos } from "@/features/facturacion/utils/totalesConceptos";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { Moneda } from "@/types/db";

export interface TotalFacturaMxn {
  /** Total convertido a MXN; 0 cuando falta un tipo de cambio confiable. */
  mxn: number;
  /** true = moneda extranjera sin TC confiable (no se simuló 1:1). */
  tcFaltante: boolean;
}

/**
 * Total en MXN de una factura manual, considerando IVA por concepto y moneda.
 * FIX C6: la conversión pasa por el canon único; ya no se multiplica por 1
 * cuando falta el tipo de cambio.
 * A-11: delega el cálculo de subtotal/IVA a `calcularTotalesConceptos`, el
 * helper canónico compartido con el resumen de facturación — incluye el 8%
 * de IVA frontera (`gravado_8`), que antes se perdía porque sólo se
 * reconocía `gravado_16`.
 */
export function calcularTotalMxn(
  conceptos: ConceptoManualInput[],
  moneda: Moneda,
  tipoCambio: number,
  tasaIva: number,
): TotalFacturaMxn {
  const { subtotal, total } = calcularTotalesConceptos(conceptos, tasaIva);
  const conv = aMxn(total || subtotal, moneda, tipoCambio);
  return { mxn: conv.monto, tcFaltante: !conv.completo };
}
