import currency from "currency.js";

/** Tipo estricto de moneda soportada */
export type Moneda = 'USD' | 'MXN' | 'EUR';

/** Tasa de IVA estándar en México (fallback cuando no hay configuración) */
export const TASA_IVA = 0.16;

/**
 * Toda la aritmética monetaria se delega a currency.js para evitar errores
 * de punto flotante (0.1 + 0.2 !== 0.3). No usamos Math.round ni toFixed:
 * el redondeo lo maneja currency.js internamente vía `precision`.
 */
const money = (n: number) => currency(n, { precision: 2 });
const ratio = (n: number) => currency(n, { precision: 4 });

/** Calcula el subtotal (cantidad × precio unitario) */
export function calcularSubtotal(cantidad: number, precioUnitario: number): number {
  return money(precioUnitario).multiply(cantidad).value;
}

/** Calcula el IVA sobre un monto */
export function calcularIVA(monto: number, tasa: number = TASA_IVA): number {
  return money(monto).multiply(tasa).value;
}

/** Calcula el total con IVA */
export function calcularTotalConIVA(monto: number, tasa: number = TASA_IVA): number {
  const base = money(monto);
  return base.add(base.multiply(tasa)).value;
}

/** Calcula el margen de utilidad (%) */
export function calcularMargen(venta: number, costo: number): number {
  if (venta === 0) return 0;
  return ratio(venta).subtract(costo).divide(venta).multiply(100).value;
}

/** Calcula la utilidad */
export function calcularUtilidad(venta: number, costo: number): number {
  return money(venta).subtract(costo).value;
}

/** Convierte un monto a MXN según su moneda */
export function convertirAMXN(
  monto: number,
  moneda: Moneda,
  tipoCambioUSD: number = 1,
  tipoCambioEUR: number = 1
): number {
  if (moneda === 'USD') return money(monto).multiply(tipoCambioUSD).value;
  if (moneda === 'EUR') return money(monto).multiply(tipoCambioEUR).value;
  return monto;
}

/** Convierte un monto a USD según su moneda */
export function convertirAUSD(
  monto: number,
  moneda: Moneda,
  tipoCambioUSD: number,
  tipoCambioEUR: number
): number {
  if (moneda === 'MXN') return money(monto).divide(tipoCambioUSD).value;
  if (moneda === 'EUR') return money(monto).multiply(tipoCambioEUR).divide(tipoCambioUSD).value;
  return monto;
}
