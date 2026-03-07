/** Tasa de IVA estándar en México */
export const TASA_IVA = 0.16;

/** Calcula el subtotal (cantidad × precio unitario) */
export function calcularSubtotal(cantidad: number, precioUnitario: number): number {
  return cantidad * precioUnitario;
}

/** Calcula el IVA sobre un monto */
export function calcularIVA(monto: number, tasa: number = TASA_IVA): number {
  return monto * tasa;
}

/** Calcula el total con IVA */
export function calcularTotalConIVA(monto: number, tasa: number = TASA_IVA): number {
  return monto * (1 + tasa);
}

/** Calcula el margen de utilidad (%) */
export function calcularMargen(venta: number, costo: number): number {
  if (venta === 0) return 0;
  return ((venta - costo) / venta) * 100;
}

/** Calcula la utilidad */
export function calcularUtilidad(venta: number, costo: number): number {
  return venta - costo;
}

/** Convierte un monto a MXN según su moneda */
export function convertirAMXN(
  monto: number,
  moneda: string,
  tipoCambioUSD: number = 1,
  tipoCambioEUR: number = 1
): number {
  if (moneda === 'USD') return monto * tipoCambioUSD;
  if (moneda === 'EUR') return monto * tipoCambioEUR;
  return monto;
}
