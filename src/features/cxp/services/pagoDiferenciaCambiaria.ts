/**
 * Diferencia cambiaria sugerida al pagar en MXN una factura en USD/EUR.
 *
 * Es la utilidad/pérdida por mover el tipo de cambio entre la fecha de la
 * factura y la fecha del pago:
 *   monto (en moneda de la factura) × (TC del pago − TC de la factura)
 *
 * Positiva = se pagaron más pesos que los provisionados (pérdida cambiaria).
 */
export function sugerirDiferenciaCambiaria(a: {
  montoEnMonedaFactura: number;
  tcPago: number | null;
  tcFactura: number | null;
}): number | null {
  const { montoEnMonedaFactura, tcPago, tcFactura } = a;
  if (!tcPago || !tcFactura || tcPago <= 0 || tcFactura <= 0) return null;
  if (!Number.isFinite(montoEnMonedaFactura) || montoEnMonedaFactura <= 0) return null;
  return Math.round(montoEnMonedaFactura * (tcPago - tcFactura) * 100) / 100;
}
