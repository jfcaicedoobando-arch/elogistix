/** Proyección de la factura CxP a los campos que necesita `saldoDisponiblePago`. */
import type { FacturaCxP } from "@/features/cxp/services";

export function facturaSaldoInput(f: FacturaCxP) {
  return {
    moneda: f.moneda,
    saldo: f.saldo,
    total: f.total,
    subtotal: f.subtotal,
    iva: f.iva,
    ieps: f.ieps,
    retenciones: f.retenciones,
    fecha_emision: f.fecha_emision,
    estado_aprobacion: f.estado_aprobacion,
  };
}
