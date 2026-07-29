/**
 * Helpers puros para `pnlPorContenedor.ts` — extraídos en v13.182.0
 * (Wave 2 · Power-of-10 splits). Sin cambios de comportamiento.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

export const round2 = (n: number): number => roundMoney(n);

export const calcMargen = (utilidad: number, venta: number): number =>
  venta > 0 ? (utilidad / venta) * 100 : 0;

export interface AcumuladorContenedor {
  ventaDirecta: number;
  costoDirecto: number;
}

/**
 * Reparte un monto general entre N partes con regla "residuo al último".
 * Cada parte queda en 2 decimales y la suma cuadra al centavo.
 */
export function repartirFlat(monto: number, n: number): number[] {
  if (n <= 0) return [];
  const partes = new Array<number>(n);
  const base = round2(monto / n);
  let acumulado = 0;
  for (let i = 0; i < n - 1; i += 1) {
    partes[i] = base;
    acumulado = round2(acumulado + base);
  }
  partes[n - 1] = round2(monto - acumulado);
  return partes;
}

export function isActivo<T extends { deleted_at?: string | null }>(row: T): boolean {
  return !row.deleted_at;
}
