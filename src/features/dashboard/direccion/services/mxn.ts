/**
 * Helpers de conversión a MXN y de mes de negocio del tablero de Dirección.
 * FIX C6: la conversión delega en el canon único `src/lib/financial/convertir.ts`.
 */
import { aMxn } from "@/lib/financial/convertir";
import { hoyMx, ymMx } from "@/lib/date/mx";

/** Tipos de cambio de respaldo POR MONEDA (MXN por 1 unidad de la divisa). */
export interface TcFallbacks {
  usd?: number | null;
  eur?: number | null;
}

export function toMxn(monto: number | null | undefined, moneda: string | null | undefined, tcUsd: number, tcEur: number): number {
  const mon = (moneda ?? "MXN").toUpperCase();
  const tc = mon === "EUR" ? tcEur : tcUsd;
  // Sin TC confiable devolvemos 0 en vez de contaminar los KPIs con
  // USD/EUR sumados como MXN.
  return aMxn(monto, mon, tc).monto;
}

/** Fallback correcto para la moneda: `undefined` (sin fallback) si no hay uno propio. */
export function fallbackDeMoneda(moneda: string | null | undefined, fallbacks: TcFallbacks): number | null {
  const mon = (moneda ?? "MXN").toUpperCase();
  if (mon === "USD") return fallbacks.usd ?? null;
  if (mon === "EUR") return fallbacks.eur ?? null;
  // Divisa desconocida: sin fallback propio, no se inventa TC.
  return null;
}

/**
 * MXN equivalente para facturas: usa el `tipo_cambio` de la factura y, si es
 * inválido, el fallback de SU PROPIA moneda.
 * P1/P2 moneda: antes cualquier divisa caía al fallback USD, así que una
 * factura EUR sin TC se valuaba con el TC del dólar (cifra creíble pero falsa).
 * Sin TC ni fallback propio devuelve 0 (no contamina KPIs).
 */
export function mxnFactura(
  monto: number, moneda: string, tipoCambio: number | null, fallbacks: TcFallbacks,
): number {
  return aMxn(monto, moneda, tipoCambio, { fallback: fallbackDeMoneda(moneda, fallbacks) }).monto;
}

/** Mes de negocio (`YYYY-MM`) en America/Mexico_City. */
export function mesNegocio(hoy: Date = new Date()): string {
  return ymMx(hoy);
}

/**
 * Aritmética mensual PURA sobre `YYYY-MM` (sin Date, sin zona horaria):
 * `mesMasOffset("2026-01", -1) === "2025-12"`.
 */
export function mesMasOffset(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + offset;
  const año = Math.floor(total / 12);
  const mes = total - año * 12 + 1;
  return `${String(año).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

/** Meses de historia que cubre el tablero de Dirección. */
export const HORIZONTE_MESES_DIRECCION = 6;

/**
 * Inicio (date-only) de la ventana del tablero de Dirección: primer día del mes
 * de hace 5 meses según el calendario de México. P1 fecha de negocio: antes se
 * derivaba en UTC, así que el tablero cambiaba de mes a las 18:00 CDMX.
 */
export function ventanaDireccionDesdeIso(hoy: Date = new Date()): string {
  return `${mesMasOffset(mesNegocio(hoy), -(HORIZONTE_MESES_DIRECCION - 1))}-01`;
}

/** Día de negocio (`YYYY-MM-DD`) en México. */
export function diaNegocio(hoy: Date = new Date()): string {
  return hoyMx(hoy);
}
