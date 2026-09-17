/**
 * N11 (Ola E2 · A): un movimiento bancario sólo puede conciliarse con un pago
 * cuyo importe coincida. Antes un depósito de $100 podía "pagar" una factura de
 * $10,000 y el pago desaparecía de pendientes sin ninguna señal.
 *
 * La regla vive también en el disparador `assert_movimiento_pago_consistente`
 * (base de datos); aquí se valida antes de escribir para dar un mensaje claro.
 *
 * MNY P1.2: la tolerancia depende de la moneda del importe (ver
 * `toleranciaMonto`). Un dólar o un euro de diferencia no es redondeo.
 */
import { toleranciaMonto } from "./tolerancia";

/** Tolerancia histórica en pesos (compatibilidad; usa `toleranciaMonto`). */
export const TOLERANCIA_CONCILIACION = 1;

export interface MontoMovimiento {
  cargo: number | string | null;
  abono: number | string | null;
}

/** Importe absoluto del movimiento: es cargo o abono, nunca ambos. */
export function importeMovimiento(mov: MontoMovimiento): number {
  return Math.max(Number(mov.cargo ?? 0), Number(mov.abono ?? 0));
}

/**
 * `true` cuando movimiento y pago cuadran dentro de la tolerancia de su moneda.
 * Moneda desconocida ⇒ se exige coincidencia exacta (falla cerrado).
 */
export function montosCuadran(
  movimiento: number,
  pago: number,
  moneda?: string | null,
): boolean {
  if (!(movimiento > 0) || !(pago > 0)) return true;
  const tol = moneda === undefined ? TOLERANCIA_CONCILIACION : toleranciaMonto(moneda);
  return Math.abs(movimiento - pago) <= tol;
}
