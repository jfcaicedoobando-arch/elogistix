/**
 * Cálculo puro del saldo de la factura después de aplicar un anticipo.
 *
 * MNY P2.4: cuando el anticipo está en otra moneda, el monto capturado NO se
 * puede restar tal cual del saldo de la factura (100 USD no bajan 100 EUR). Se
 * convierte con la paridad DOF de la fecha de aplicación — la misma que usa el
 * servidor — y si no hay paridad no se muestra un saldo ficticio (`null`).
 */
import { convertirMoneda, type TcDofMxn } from "./topeAplicacionAnticipo";

export interface SaldoDespuesParams {
  /** Saldo por pagar de la factura (neto de pagos y notas de crédito). */
  saldoFactura: number;
  /** Monto que el usuario quiere aplicar (en la moneda del anticipo). */
  montoAplicar: number;
  monedaFactura: string;
  monedaAnticipo: string;
  /** Paridades DOF de la fecha de aplicación (necesarias si las monedas difieren). */
  tc?: TcDofMxn | null;
}

export interface SaldoDespuesResultado {
  /** Saldo restante estimado en la moneda de la factura; `null` si no se puede estimar. */
  saldoRestante: number | null;
  /** Monto a aplicar expresado en la moneda de la factura; `null` sin paridad. */
  montoEnMonedaFactura: number | null;
  /** Excedente que no cabe en el saldo de la factura (0 si cabe todo). */
  excedente: number;
  /** true si el saldo restante es sólo una estimación (moneda distinta). */
  estimado: boolean;
  /** true si falta la paridad DOF para convertir: no hay cifra que mostrar. */
  sinTipoCambio: boolean;
  /** true si la aplicación deja la factura totalmente cubierta. */
  quedaCubierta: boolean;
}

const TOL = 0.01;

export function calcularSaldoDespuesDeAplicar(
  { saldoFactura, montoAplicar, monedaFactura, monedaAnticipo, tc }: SaldoDespuesParams,
): SaldoDespuesResultado {
  const saldo = Number.isFinite(saldoFactura) ? Math.max(0, saldoFactura) : 0;
  const monto = Number.isFinite(montoAplicar) ? Math.max(0, montoAplicar) : 0;
  const estimado = monedaAnticipo !== monedaFactura;
  const convertido = estimado
    ? convertirMoneda(monto, monedaAnticipo, monedaFactura, tc)
    : monto;

  if (convertido === null) {
    return {
      saldoRestante: null,
      montoEnMonedaFactura: null,
      excedente: 0,
      estimado,
      sinTipoCambio: true,
      quedaCubierta: false,
    };
  }

  const saldoRestante = Math.max(0, saldo - convertido);
  return {
    saldoRestante,
    montoEnMonedaFactura: convertido,
    excedente: Math.max(0, convertido - saldo),
    estimado,
    sinTipoCambio: false,
    // BL-13: con monedas distintas el saldo restante sigue siendo referencial
    // (el servidor valúa al aplicar). Nunca afirmar "queda cubierta".
    quedaCubierta: !estimado && saldoRestante <= TOL,
  };
}
