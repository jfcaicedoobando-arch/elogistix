/**
 * Cálculo puro de totales para conceptos de factura manual.
 * Extraído para compartir entre `FacturaManualConceptosTable` (que muestra el
 * pie legacy) y el panel de resumen navy del `DialogNuevaFacturaManual`.
 */
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

function tasaDeTipo(tipo: TipoIvaConcepto, tasaIva: number): number {
  if (tipo === "gravado_16") return tasaIva;
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
    (acc, c) => acc + Number(c.cantidad || 0) * Number(c.precio_unitario || 0),
    0,
  );
  const iva = conceptos.reduce((acc, c) => {
    const importe = Number(c.cantidad || 0) * Number(c.precio_unitario || 0);
    return acc + importe * tasaDeTipo(c.tipo_iva ?? "gravado_16", tasaIva);
  }, 0);
  const subtotalR = Math.round(subtotal * 100) / 100;
  const ivaR = Math.round(iva * 100) / 100;
  const total = Math.round((subtotalR + ivaR) * 100) / 100;
  return { subtotal: subtotalR, iva: ivaR, total };
}
