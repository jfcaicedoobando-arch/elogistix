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

/** Banderas derivadas de la moneda del pago vs la de la factura. */
export function banderasMonedaPago(args: {
  factura: FacturaCxP | null;
  moneda: string;
  monto: string;
  tcNum: number | null;
}) {
  const { factura, moneda, monto, tcNum } = args;
  const montoNum = Number(monto) || 0;
  const monedaFacturaExtranjera = !!factura && factura.moneda !== "MXN";
  const esUsdPagadoEnMxn = monedaFacturaExtranjera && moneda === "MXN";
  const showTc = moneda !== "MXN" || esUsdPagadoEnMxn;
  const bloqueadoPorTc = esUsdPagadoEnMxn && !tcNum;
  return { montoNum, monedaFacturaExtranjera, esUsdPagadoEnMxn, showTc, bloqueadoPorTc };
}
