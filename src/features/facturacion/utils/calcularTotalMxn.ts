import { aMxn } from "@/lib/financial/convertir";
import { sumarSubtotales, subtotalLinea, calcularIVA, roundMoney } from "@/lib/financial/financialUtils";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

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
 */
export function calcularTotalMxn(
  conceptos: ConceptoManualInput[],
  moneda: "MXN" | "USD" | "EUR",
  tipoCambio: number,
  tasaIva: number,
): TotalFacturaMxn {
  // FE-12: canon currency.js — subtotal por línea redondeado antes de acumular
  // e IVA por línea con el mismo redondeo, para que la validación de crédito
  // coincida centavo a centavo con el total que se persiste/timbra.
  const subtotal = sumarSubtotales(conceptos, (c) => ({
    cantidad: Number(c.cantidad) || 0,
    precioUnitario: Number(c.precio_unitario) || 0,
  }));
  const conIva = roundMoney(
    conceptos.reduce((acc, c) => {
      const base = subtotalLinea(Number(c.cantidad) || 0, Number(c.precio_unitario) || 0);
      const iva = c.tipo_iva === "gravado_16" ? calcularIVA(base, tasaIva) : 0;
      return acc + base + iva;
    }, 0),
  );
  const total = conIva || subtotal;
  const conv = aMxn(total, moneda, tipoCambio);
  return { mxn: conv.monto, tcFaltante: !conv.completo };
}
