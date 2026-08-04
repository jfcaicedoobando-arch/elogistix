/**
 * FIX 10 — Normaliza el subtotal de una cotización a MXN para poder ordenar
 * la lista sin mezclar montos nominales de distintas monedas. Usa el canon
 * único `aMxn` (@/lib/financial/convertir): si no hay TC confiable, el valor
 * no es "convertible" y el llamador debe enviarlo al final del orden.
 */
import { aMxn } from "@/lib/financial/convertir";

/**
 * @returns el equivalente en MXN, o `null` cuando no hay TC confiable
 * (p.ej. USD sin tipo de cambio publicado).
 */
export function normalizarSubtotalMxn(
  monto: number | null | undefined,
  moneda: string | null | undefined,
  usdMxn: number | null | undefined,
): number | null {
  const conversion = aMxn(monto, moneda, usdMxn);
  return conversion.completo ? conversion.monto : null;
}
