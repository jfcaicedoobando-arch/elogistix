import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

/**
 * Total en MXN de una factura manual, considerando IVA por concepto y moneda.
 * Extraído de `DialogNuevaFacturaManual` (Power of 10 · límite 200 líneas).
 */
export function calcularTotalMxn(
  conceptos: ConceptoManualInput[],
  moneda: "MXN" | "USD" | "EUR",
  tipoCambio: number,
  tasaIva: number,
): number {
  const subtotal = conceptos.reduce((acc, c) => {
    const cant = Number(c.cantidad) || 0;
    const precio = Number(c.precio_unitario) || 0;
    return acc + cant * precio;
  }, 0);
  const conIva = conceptos.reduce((acc, c) => {
    const cant = Number(c.cantidad) || 0;
    const precio = Number(c.precio_unitario) || 0;
    const base = cant * precio;
    const iva = c.tipo_iva === "gravado_16" ? base * tasaIva : 0;
    return acc + base + iva;
  }, 0);
  const total = conIva || subtotal;
  const tc = moneda === "MXN" ? 1 : Math.max(0, Number(tipoCambio) || 1);
  return total * tc;
}
