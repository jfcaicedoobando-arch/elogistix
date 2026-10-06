import Decimal from "decimal.js";
import { tcConfiable } from "./convertir";

/** Lectura de cobros con paridad a convertir_monto_pago_a_factura.
 * MXN↔USD usa el TC convenido del cobro; cruces EUR pivotan en MXN con
 * el TC del origen y el TC histórico de la factura. Nunca usa TC actual.
 * null significa que el histórico no permite calcular un excedente fiable.
 */
export function montoCobroEnMonedaFactura(
  monto: number, monedaPago: string, tcPago: number | null,
  monedaFactura: string, tcFactura: number | null | undefined,
): number | null {
  const monedas = ["MXN", "USD", "EUR"];
  if (!Number.isFinite(monto) || monto < 0 ||
      !monedas.includes(monedaPago) || !monedas.includes(monedaFactura)) return null;
  if (monedaPago === monedaFactura) return monto;
  const cruceMxnUsd = [monedaPago, monedaFactura].every((m) => m === "MXN" || m === "USD");
  const origen = monedaPago === "MXN" ? 1 : tcConfiable(tcPago);
  const destino = monedaFactura === "MXN" ? 1 : tcConfiable(cruceMxnUsd ? tcPago : tcFactura);
  if (origen === null || destino === null) return null;
  const convertido = new Decimal(monto).times(origen).dividedBy(destino)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  return Number.isFinite(convertido) ? convertido : null;
}
