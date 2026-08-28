/**
 * Cálculo puro de totales para conceptos de factura manual.
 * Extraído para compartir entre `FacturaManualConceptosTable` (que muestra el
 * pie legacy) y el panel de resumen navy del `DialogNuevaFacturaManual`.
 */
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";
import { TASA_IVA_FRONTERA } from "@/features/facturacion/services/conceptosFacturaShared";
import { subtotalLinea, calcularIVA, roundMoney } from "@/lib/financial/financialUtils";

function tasaDeTipo(tipo: TipoIvaConcepto, tasaIva: number): number {
  if (tipo === "gravado_16") return tasaIva;
  if (tipo === "gravado_8") return TASA_IVA_FRONTERA;
  if (tipo === "tasa_0") return 0;
  return 0; // exento no aporta IVA
}

export interface TotalesConceptos {
  subtotal: number;
  iva: number;
  total: number;
}

export function calcularTotalesConceptos(
  conceptos: ConceptoManualInput[],
  tasaIva: number,
): TotalesConceptos {
  const subtotal = conceptos.reduce(
    (acc, c) => acc + subtotalLinea(Number(c.cantidad || 0), Number(c.precio_unitario || 0)),
    0,
  );
  const iva = conceptos.reduce((acc, c) => {
    const importe = subtotalLinea(Number(c.cantidad || 0), Number(c.precio_unitario || 0));
    return acc + calcularIVA(importe, tasaDeTipo(c.tipo_iva ?? "gravado_16", tasaIva));
  }, 0);
  const subtotalR = roundMoney(subtotal);
  const ivaR = roundMoney(iva);
  const total = roundMoney(subtotalR + ivaR);
  return { subtotal: subtotalR, iva: ivaR, total };
}
