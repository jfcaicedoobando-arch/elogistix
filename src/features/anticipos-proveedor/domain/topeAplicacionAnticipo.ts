/**
 * Tope aplicable de un anticipo sobre una factura, en la MONEDA DEL ANTICIPO.
 *
 * MNY P1.3: el monto viaja a `aplicar_anticipo_a_factura` en la moneda del
 * anticipo y el servidor lo valúa con la paridad DOF del día de la aplicación.
 * Comparar ese monto contra el saldo de la factura sin convertir (lo que se
 * hacía antes) mezclaba dos monedas distintas: 100 USD "cabían" en un saldo de
 * 100 EUR. Aquí se convierte con el DOF de la fecha de aplicación y, si no hay
 * paridad disponible, se devuelve `null` (fail-closed: la UI no inventa 1:1).
 */

/** Paridades DOF disponibles (pesos por 1 unidad de divisa). */
export interface TcDofMxn {
  usdMxn?: number | null;
  eurMxn?: number | null;
}

const redondear4 = (n: number) => Math.round(n * 10_000) / 10_000;
const truncar2 = (n: number) => Math.floor(n * 100) / 100;

/** Pesos por 1 unidad de la moneda dada; `null` si no hay paridad publicada. */
export function tcAMxn(moneda: string, tc: TcDofMxn | null | undefined): number | null {
  const m = (moneda || "MXN").toUpperCase();
  if (m === "MXN") return 1;
  const v = m === "USD" ? tc?.usdMxn : m === "EUR" ? tc?.eurMxn : null;
  return Number(v) > 0 ? Number(v) : null;
}

/** Convierte pivotando en MXN. `null` cuando falta alguna paridad. */
export function convertirMoneda(
  monto: number,
  origen: string,
  destino: string,
  tc: TcDofMxn | null | undefined,
): number | null {
  if (!Number.isFinite(monto)) return null;
  if ((origen || "MXN").toUpperCase() === (destino || "MXN").toUpperCase()) return monto;
  const o = tcAMxn(origen, tc);
  const d = tcAMxn(destino, tc);
  if (o === null || d === null) return null;
  return redondear4((monto * o) / d);
}

export interface TopeAplicableParams {
  /** Saldo a favor del anticipo (en su propia moneda). */
  disponible: number;
  monedaAnticipo: string;
  /** Saldo por pagar de la factura (en la moneda de la factura). */
  saldoFactura: number;
  monedaFactura: string;
  /** Paridades DOF de la fecha de aplicación. */
  tc: TcDofMxn | null | undefined;
}

export interface TopeAplicableResultado {
  /** Máximo aplicable en la moneda del ANTICIPO; `null` si falta paridad. */
  tope: number | null;
  /** Saldo de la factura expresado en la moneda del anticipo. */
  saldoFacturaEnMonedaAnticipo: number | null;
  requiereConversion: boolean;
  sinTipoCambio: boolean;
}

export function calcularTopeAplicable(
  { disponible, monedaAnticipo, saldoFactura, monedaFactura, tc }: TopeAplicableParams,
): TopeAplicableResultado {
  const requiereConversion =
    (monedaAnticipo || "MXN").toUpperCase() !== (monedaFactura || "MXN").toUpperCase();
  const disp = Number.isFinite(disponible) ? Math.max(0, disponible) : 0;
  const saldo = Number.isFinite(saldoFactura) ? Math.max(0, saldoFactura) : 0;
  const convertido = convertirMoneda(saldo, monedaFactura, monedaAnticipo, tc);
  if (convertido === null) {
    return {
      tope: null,
      saldoFacturaEnMonedaAnticipo: null,
      requiereConversion,
      sinTipoCambio: true,
    };
  }
  return {
    tope: truncar2(Math.max(0, Math.min(disp, convertido))),
    saldoFacturaEnMonedaAnticipo: convertido,
    requiereConversion,
    sinTipoCambio: false,
  };
}
