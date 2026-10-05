import Decimal from "decimal.js";

/** Paridad con monto_pago_en_moneda_factura(monto, origen, TC guardado, destino).
 * CxP usa el TC del pago/NC, redondea cada conversión a cuatro decimales y
 * no dispone de tasas cruzadas USD/EUR. El TC de factura no participa.
 */
export function montoProveedorEnMonedaFactura(
  monto: number, monedaOrigen: string, tipoCambio: number | null, monedaFactura: string,
): number | null {
  if (!Number.isFinite(monto)) return null;
  const monedas = ["MXN", "USD", "EUR"];
  if (!monedas.includes(monedaOrigen) || !monedas.includes(monedaFactura)) return null;
  if (monedaOrigen === monedaFactura) return monto;
  if (tipoCambio == null || !Number.isFinite(Number(tipoCambio)) || Number(tipoCambio) <= 0) return null;
  let convertido: Decimal;
  if (monedaOrigen === "MXN") convertido = new Decimal(monto).dividedBy(tipoCambio);
  else if (monedaFactura === "MXN") convertido = new Decimal(monto).times(tipoCambio);
  else return null;
  return convertido.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}
