/**
 * Cálculo puro de totales para conceptos de factura manual.
 * Extraído para compartir entre `FacturaManualConceptosTable` (que muestra el
 * pie legacy) y el panel de resumen navy del `DialogNuevaFacturaManual`.
 */
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import { sumarMontos } from "@/lib/financial/financialUtils";
import { calcularImportesManual } from "@/features/facturacion/domain/facturaManualCalculo";

export interface TotalesConceptos {
  subtotal: number;
  iva: number;
  total: number;
}

export function calcularTotalesConceptos(
  conceptos: ConceptoManualInput[],
  tasaIva: number,
): TotalesConceptos {
  const lineas = conceptos.map((c) => calcularImportesManual(c, tasaIva));
  const subtotal = sumarMontos(lineas.map((c) => c.totalLinea));
  const iva = sumarMontos(lineas.map((c) => c.ivaLinea));
  return { subtotal, iva, total: sumarMontos([subtotal, iva]) };
}
