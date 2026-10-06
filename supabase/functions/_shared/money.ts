import { Decimal } from "npm:decimal.js@10.6.0";

/** Same finite-input cent policy as financialUtils and Postgres numeric ROUND. */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Subtract before rounding; avoid introducing binary cancellation errors. */
export function saldoMonetario(total: number, aplicados: number[]): number {
  if (!Number.isFinite(total) || aplicados.some((n) => !Number.isFinite(n))) {
    throw new Error("El saldo requiere importes finitos.");
  }
  return aplicados.reduce((saldo, monto) => saldo.minus(monto), new Decimal(total))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}
