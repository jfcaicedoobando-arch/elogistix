/**
 * Helpers de conversión a MXN reutilizados por los servicios de dirección.
 */
import { convertirAMXN, type Moneda } from "@/lib/financial/financialUtils";

export function toMxn(monto: number | null | undefined, moneda: string | null | undefined, tcUsd: number, tcEur: number): number {
  const m = Number(monto ?? 0);
  const mon = (moneda ?? "MXN") as Moneda;
  return convertirAMXN(m, mon, tcUsd || 1, tcEur || 1);
}

/** MXN equivalente para facturas: usa `tipo_cambio` de la factura; si es <=1 (USD/EUR sin TC), usa fallback. */
export function mxnFactura(monto: number, moneda: string, tipoCambio: number | null, fallbackUsd: number): number {
  if (moneda === "MXN") return Number(monto);
  const tc = Number(tipoCambio) || 0;
  if (tc > 1) return Number(monto) * tc;
  if (fallbackUsd > 0) return Number(monto) * fallbackUsd;
  return 0;
}

export function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function inicioMesUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function finMesUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
