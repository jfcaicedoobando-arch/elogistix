/**
 * Candado puro contra el "IVA fantasma" en la captura de facturas de proveedor.
 *
 * FP-000256: la lectura del PDF dejó IVA = 50 USD sobre un subtotal de 60 USD
 * (renglones sin impuesto). El total se calcula como subtotal + IVA + IEPS −
 * retenciones, así que la factura quedó en 110 USD sin ningún renglón que lo
 * respalde y nada lo bloqueó.
 *
 * Regla mínima: en México el IVA trasladado nunca excede el 16% de la base.
 * No se exige que el IVA del encabezado sea igual a la suma del IVA de los
 * renglones porque muchos PDFs legítimos no desglosan impuesto por línea.
 */

/** Tasa máxima de IVA trasladado en México. */
export const TASA_IVA_MAXIMA = 0.16;
/** Tolerancia de redondeo a centavos. */
const TOLERANCIA = 0.02;

/** IVA máximo aceptable para un subtotal dado. */
export function ivaMaximoAceptable(subtotal: number): number {
  return Math.max(0, Number(subtotal) || 0) * TASA_IVA_MAXIMA + TOLERANCIA;
}

/** `true` cuando el IVA capturado no puede provenir del subtotal declarado. */
export function ivaExcedeTasaMaxima(subtotal: number, iva: number): boolean {
  const ivaNum = Number(iva) || 0;
  if (ivaNum <= 0) return false;
  return ivaNum > ivaMaximoAceptable(subtotal);
}
