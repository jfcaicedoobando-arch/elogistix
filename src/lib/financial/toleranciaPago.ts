import Decimal from "decimal.js";

/**
 * Tolerancia canónica (en unidades de moneda) para comparaciones de saldo en
 * pagos/cobros. Unifica los literales dispersos (`0.01`, `0.009`) que la
 * auditoría BUG-15 / FE-15 detectó en `DialogRegistrarPago` y `CobroLoteRenglon`.
 *
 * Medio centavo: absorbe el error de redondeo de centavo al convertir entre
 * monedas o al repartir un cobro en lote, sin permitir sobrepagos reales de
 * ≥ 1 centavo.
 */
export const TOLERANCIA_SOBREPAGO = 0.005;

/**
 * Deuda monetaria positiva según ROUND(numeric, 2), sin alterar el saldo exacto.
 * El empate 0.005 es cobrable; 0.01 nunca se condona como "tolerancia".
 * Restar en Decimal evita que 1.16 - 1.155 caiga bajo el empate por ruido binario.
 */
export function tieneSaldoMonetario(saldo: number, aplicado = 0): boolean {
  if (!Number.isFinite(saldo) || !Number.isFinite(aplicado)) return false;
  return new Decimal(saldo).minus(aplicado).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).greaterThan(0);
}
