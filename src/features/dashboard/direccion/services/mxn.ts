/**
 * Helpers de conversión a MXN reutilizados por los servicios de dirección.
 * FIX-11: usa `tcValido` — nunca colapsa a 1 para monedas extranjeras.
 */
import { convertirAMXN, type Moneda } from "@/lib/financial/financialUtils";
import { tcValido } from "@/lib/financial/tcValido";
import { isoUtcDay } from "@/lib/date/mx";

export function toMxn(monto: number | null | undefined, moneda: string | null | undefined, tcUsd: number, tcEur: number): number {
  const m = Number(monto ?? 0);
  const mon = (moneda ?? "MXN") as Moneda;
  if (mon === "MXN") return m;
  const tcU = tcValido(tcUsd);
  const tcE = tcValido(tcEur);
  // FIX-11: si el TC de la moneda no es válido, devolvemos 0 en vez de
  // multiplicar por 1 y contaminar los KPIs con USD/EUR sumados como MXN.
  if (mon === "USD" && !tcU) return 0;
  if (mon === "EUR" && !tcE) return 0;
  return convertirAMXN(m, mon, tcU ?? 0, tcE ?? 0);
}

/** MXN equivalente para facturas: usa `tipo_cambio` de la factura; si es inválido, cae al fallback (USD). */
export function mxnFactura(monto: number, moneda: string, tipoCambio: number | null, fallbackUsd: number): number {
  if (moneda === "MXN") return Number(monto);
  const tc = tcValido(tipoCambio);
  if (tc) return Number(monto) * tc;
  const fb = tcValido(fallbackUsd);
  if (fb) return Number(monto) * fb;
  return 0;
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
