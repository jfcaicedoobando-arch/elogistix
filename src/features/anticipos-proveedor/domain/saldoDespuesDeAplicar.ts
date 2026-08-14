/**
 * Cálculo puro del saldo de la factura después de aplicar un anticipo.
 * Cuando el anticipo está en otra moneda el resultado es sólo referencial:
 * el servidor convierte al tipo de cambio autoritativo al aplicar.
 */

export interface SaldoDespuesParams {
  /** Saldo por pagar de la factura (neto de pagos y notas de crédito). */
  saldoFactura: number;
  /** Monto que el usuario quiere aplicar (en la moneda del anticipo). */
  montoAplicar: number;
  monedaFactura: string;
  monedaAnticipo: string;
}

export interface SaldoDespuesResultado {
  /** Saldo restante estimado; nunca negativo. */
  saldoRestante: number;
  /** Excedente que no cabe en el saldo de la factura (0 si cabe todo). */
  excedente: number;
  /** true si el saldo restante es sólo una estimación (moneda distinta). */
  estimado: boolean;
  /** true si la aplicación deja la factura totalmente cubierta. */
  quedaCubierta: boolean;
}

const TOL = 0.01;

export function calcularSaldoDespuesDeAplicar(
  { saldoFactura, montoAplicar, monedaFactura, monedaAnticipo }: SaldoDespuesParams,
): SaldoDespuesResultado {
  const saldo = Number.isFinite(saldoFactura) ? Math.max(0, saldoFactura) : 0;
  const monto = Number.isFinite(montoAplicar) ? Math.max(0, montoAplicar) : 0;
  const estimado = monedaAnticipo !== monedaFactura;
  const saldoRestante = Math.max(0, saldo - monto);
  const excedente = Math.max(0, monto - saldo);
  return {
    saldoRestante,
    excedente,
    estimado,
    quedaCubierta: saldoRestante <= TOL,
  };
}
