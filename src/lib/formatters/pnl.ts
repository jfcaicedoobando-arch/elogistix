/**
 * Helpers numéricos específicos del módulo P&L de embarques.
 * Extraído de `TabPnl.tsx` en v13.56.2 (auditoría — paso 5).
 */
import { formatCurrency } from "@/lib/formatters";

/** Formato MXN compacto para tarjetas/tablas de P&L. */
export const fmtPnl = (n: number): string => formatCurrency(n ?? 0, "MXN");

/** Porcentaje con 1 decimal. */
export const pctPnl = (n: number): string => `${(n ?? 0).toFixed(1)}%`;

/** Diferencia absoluta y porcentual entre real y presupuesto. */
export function deltaPnl(real: number, presup: number): { abs: number; pct: number } {
  const abs = (real ?? 0) - (presup ?? 0);
  const p = presup > 0 ? (abs / presup) * 100 : 0;
  return { abs, pct: p };
}
