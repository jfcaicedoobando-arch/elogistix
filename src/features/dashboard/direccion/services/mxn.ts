/**
 * Helpers de conversión a MXN reutilizados por los servicios de dirección.
 * FIX C6: delegan en el canon único `src/lib/financial/convertir.ts`.
 */
import { aMxn } from "@/lib/financial/convertir";
import { isoUtcDay } from "@/lib/date/mx";

export function toMxn(monto: number | null | undefined, moneda: string | null | undefined, tcUsd: number, tcEur: number): number {
  const mon = (moneda ?? "MXN").toUpperCase();
  const tc = mon === "EUR" ? tcEur : tcUsd;
  // Sin TC confiable devolvemos 0 en vez de contaminar los KPIs con
  // USD/EUR sumados como MXN.
  return aMxn(monto, mon, tc).monto;
}

/** MXN equivalente para facturas: usa `tipo_cambio` de la factura; si es inválido, cae al fallback (USD). */
export function mxnFactura(monto: number, moneda: string, tipoCambio: number | null, fallbackUsd: number): number {
  return aMxn(monto, moneda, tipoCambio, { fallback: fallbackUsd }).monto;
}

export function ym(d: Date): string {
  return isoUtcDay(d).slice(0, 7);
}

export function inicioMesUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Meses de historia que cubre el tablero de Dirección. */
export const HORIZONTE_MESES_DIRECCION = 6;

/**
 * Inicio (ISO, día UTC) de la ventana del tablero de Dirección.
 * Compartido por los KPIs de detalle y por los totales server-side (FIX C3c)
 * para que ambos hablen del mismo periodo.
 */
export function ventanaDireccionDesdeIso(hoy: Date = new Date()): string {
  const base = inicioMesUtc(hoy);
  const desde = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - (HORIZONTE_MESES_DIRECCION - 1), 1),
  );
  return isoUtcDay(desde);
}
