/**
 * Regla de margen mínimo de utilidad estimada (configurable por organización).
 * Sólo exige autorización cuando el margen queda POR DEBAJO del mínimo.
 */
import { calcularMargen } from "@/lib/financial/financialUtils";
import type { AppRole } from "@/types/appRole";

export const MARGEN_MINIMO_DEFAULT_PCT = 8;
export const MARGEN_MINIMO_CATEGORIA = "comercial";
export const MARGEN_MINIMO_CLAVE = "margen_minimo_utilidad_pct";

/** Roles que pueden autorizar un margen por debajo del mínimo y cambiar el mínimo. */
export const AUTORIZAR_MARGEN_BAJO: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
];

export function normalizarMargenMinimo(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : MARGEN_MINIMO_DEFAULT_PCT;
}

export interface EvaluacionMargen {
  margenPct: number;
  minimoPct: number;
  debajoDelMinimo: boolean;
}

export function evaluarMargenMinimo(venta: number, costo: number, minimoPct: number): EvaluacionMargen {
  // Sin venta no hay margen que evaluar (borrador sin precios).
  if (!(venta > 0)) return { margenPct: 0, minimoPct, debajoDelMinimo: false };
  const margenPct = calcularMargen(venta, costo);
  return { margenPct, minimoPct, debajoDelMinimo: margenPct < minimoPct };
}

export function puedeAutorizarMargenBajo(role: AppRole | null | undefined): boolean {
  return !!role && AUTORIZAR_MARGEN_BAJO.includes(role);
}
