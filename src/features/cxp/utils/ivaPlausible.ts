/**
 * Candado puro contra el "IVA fantasma" en la captura de facturas de proveedor.
 *
 * FP-000256: la lectura del PDF dejó IVA = 50 USD sobre un subtotal de 60 USD
 * (renglones sin impuesto). El total se calcula como subtotal + IVA + IEPS −
 * retenciones, así que la factura quedó en 110 USD sin ningún renglón que lo
 * respalde y nada lo bloqueó.
 *
 * Regla mínima: en México el IVA trasladado nunca excede el 16% de la BASE
 * GRAVABLE. La base no es sólo el subtotal: el IEPS trasladado forma parte de
 * ella (CFF/LIVA), así que subtotal 100 + IEPS 8 admite un IVA de 17.28. Antes
 * el guard sólo miraba el subtotal y bloqueaba capturas correctas.
 *
 * No es una validación fiscal general: sólo evita que el ERP acepte un IVA
 * imposible y que rechace uno legítimo.
 */

/** Tasa máxima de IVA trasladado en México. */
export const TASA_IVA_MAXIMA = 0.16;
/** Tolerancia de redondeo a centavos. */
const TOLERANCIA = 0.02;

const positivo = (v: unknown): number => Math.max(0, Number(v) || 0);

/**
 * Base gravable considerada por el guard: el subtotal más los cargos que
 * legalmente forman parte de ella y que la captura conoce (hoy, el IEPS).
 */
export function baseGravableIva(subtotal: number, baseAdicional: number = 0): number {
  return positivo(subtotal) + positivo(baseAdicional);
}

/** IVA máximo aceptable para un subtotal (más su base adicional, p. ej. IEPS). */
export function ivaMaximoAceptable(subtotal: number, baseAdicional: number = 0): number {
  return baseGravableIva(subtotal, baseAdicional) * TASA_IVA_MAXIMA + TOLERANCIA;
}

/** `true` cuando el IVA capturado no puede provenir de la base declarada. */
export function ivaExcedeTasaMaxima(
  subtotal: number,
  iva: number,
  baseAdicional: number = 0,
): boolean {
  const ivaNum = Number(iva) || 0;
  if (ivaNum <= 0) return false;
  return ivaNum > ivaMaximoAceptable(subtotal, baseAdicional);
}
