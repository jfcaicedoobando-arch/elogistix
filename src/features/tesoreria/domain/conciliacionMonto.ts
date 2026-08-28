/**
 * N11 (Ola E2 · A): un movimiento bancario sólo puede conciliarse con un pago
 * cuyo importe coincida. Antes un depósito de $100 podía "pagar" una factura de
 * $10,000 y el pago desaparecía de pendientes sin ninguna señal.
 *
 * La regla vive también en el disparador `assert_movimiento_pago_consistente`
 * (base de datos); aquí se valida antes de escribir para dar un mensaje claro.
 */

/** Tolerancia en la moneda del movimiento (centavos de redondeo bancario). */
export const TOLERANCIA_CONCILIACION = 1;

export interface MontoMovimiento {
  cargo: number | string | null;
  abono: number | string | null;
}

/** Importe absoluto del movimiento: es cargo o abono, nunca ambos. */
export function importeMovimiento(mov: MontoMovimiento): number {
  return Math.max(Number(mov.cargo ?? 0), Number(mov.abono ?? 0));
}

/** `true` cuando movimiento y pago cuadran dentro de la tolerancia. */
export function montosCuadran(movimiento: number, pago: number): boolean {
  if (!(movimiento > 0) || !(pago > 0)) return true;
  return Math.abs(movimiento - pago) <= TOLERANCIA_CONCILIACION;
}
