/**
 * Helpers para parsear filas de embarques con profit MXN/USD desde el RPC
 * `dashboard_stats()`. Extraído de `dashboard.ts` para mantener complejidad <15.
 */
import { fromDb } from "@/lib/supabase/cast";
import type { EmbarqueConProfit } from "./dashboardTypes";

/** Number(value ?? 0), pero rechaza NaN/±Infinity para no envenenar totales financieros. */
export function numOr0(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Si el campo viene definido en el payload úsalo; si no, calcula con `fallback()`. */
export function numOrCompute(v: unknown, fallback: () => number): number {
  return v !== undefined && v !== null ? Number(v) : fallback();
}

/** Margen porcentual seguro (0 si la venta es 0). */
export function safeMargen(profit: number, venta: number): number {
  return venta > 0 ? (profit / venta) * 100 : 0;
}

export function parseEmbarqueConProfitRaw(r: Record<string, unknown>): EmbarqueConProfit {
  const ventaUSD = numOr0(r.ventaUSD);
  const costoUSD = numOr0(r.costoUSD);
  const profit = numOrCompute(r.profit, () => ventaUSD - costoUSD);
  const margen = numOrCompute(r.margen, () => safeMargen(profit, ventaUSD));
  const ventaMXN = numOr0(r.ventaMXN);
  const costoMXN = numOr0(r.costoMXN);
  const profitMXN = numOrCompute(r.profitMXN, () => ventaMXN - costoMXN);
  const margenMXN = numOrCompute(r.margenMXN, () => safeMargen(profitMXN, ventaMXN));
  return {
    ...(fromDb<EmbarqueConProfit>(r)),
    ventaUSD,
    costoUSD,
    profit,
    margen,
    ventaMXN,
    costoMXN,
    profitMXN,
    margenMXN,
    tipoCambioUSD: numOr0(r.tipoCambioUSD),
    tipoCambioEUR: numOr0(r.tipoCambioEUR),
    ventaMxnFromUsd: numOr0(r.ventaMxnFromUsd),
    costoMxnFromUsd: numOr0(r.costoMxnFromUsd),
    ventaMxnFromEur: numOr0(r.ventaMxnFromEur),
    costoMxnFromEur: numOr0(r.costoMxnFromEur),
    ventaMxnNative: numOr0(r.ventaMxnNative),
    costoMxnNative: numOr0(r.costoMxnNative),
  };
}
