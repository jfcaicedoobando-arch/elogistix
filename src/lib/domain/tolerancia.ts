/**
 * 13.117.0 (Sprint Seguridad/Dinero) — Helpers puros de matching bancario.
 *
 * Extraído de `sugerirCandidatos.ts` para testear bordes. Antes el umbral
 * `±$1 / ±5 días` vivía hardcoded sin un test que cazara un cambio de
 * `<=` a `<` (silencioso, rompe conciliación en producción).
 */

import { isoUtcDay } from "@/lib/date/mx";
import { roundMoney } from "@/lib/financial/financialUtils";
import { diffDiasCalendario } from "@/lib/date/dateOnly";

export const TOLERANCIA_MONTO_MXN = 1;
export const TOLERANCIA_DIAS = 5;

/**
 * MNY P1.2: la tolerancia se expresa en la MONEDA del importe comparado, no
 * siempre en pesos. Un peso de diferencia es redondeo bancario; un dólar o un
 * euro son ~18–20 pesos y podían dejar pasar un pago distinto.
 *
 * Los importes se comparan en su moneda original (movimiento y pago siempre
 * comparten la moneda de la cuenta bancaria), así que la tolerancia por divisa
 * se fija en centavos: es más estricta que el candado de base (1.00 en la
 * moneda del movimiento), que sigue siendo la última línea de defensa.
 */
export const TOLERANCIA_MONTO_POR_MONEDA: Record<string, number> = {
  MXN: 1,
  USD: 0.05,
  EUR: 0.05,
};

/**
 * Tolerancia aplicable a una moneda. Moneda desconocida ⇒ 0 (coincidencia
 * exacta): falla cerrado en vez de asumir la tolerancia del peso.
 */
export function toleranciaMonto(moneda?: string | null): number {
  const m = String(moneda ?? "").trim().toUpperCase();
  return TOLERANCIA_MONTO_POR_MONEDA[m] ?? 0;
}

/** True si la diferencia absoluta de monto está dentro de la tolerancia (inclusivo).
 *  Diferencia y tolerancia se redondean a centavos para evitar el clásico float
 *  drift (`100.01 - 100 === 0.0100000…0005`). */
export function dentroDeTolerancia(montoA: number, montoB: number, tolerancia = TOLERANCIA_MONTO_MXN): boolean {
  if (!Number.isFinite(montoA) || !Number.isFinite(montoB)) return false;
  const delta = roundMoney(Math.abs(montoA - montoB));
  const tol = roundMoney(tolerancia);
  return delta <= tol;
}

/** Días absolutos entre dos fechas ISO `YYYY-MM-DD` (UTC, redondeado). */
export function deltaDiasIso(fechaA: string, fechaB: string): number {
  if (!Number.isFinite(Date.parse(fechaA)) || !Number.isFinite(Date.parse(fechaB))) {
    return Number.POSITIVE_INFINITY;
  }
  // Ola 19 · paso 1: helper único de días naturales (inmune a DST).
  return Math.abs(diffDiasCalendario(fechaB, fechaA));
}

/** Rango [desde, hasta] en ISO sumando ±N días a una fecha ISO. */
export function rangoFechasIso(fechaIso: string, dias = TOLERANCIA_DIAS): { desde: string; hasta: string } {
  const base = new Date(fechaIso + "T00:00:00Z");
  const desde = new Date(base); desde.setUTCDate(desde.getUTCDate() - dias);
  const hasta = new Date(base); hasta.setUTCDate(hasta.getUTCDate() + dias);
  return {
    desde: isoUtcDay(desde),
    hasta: isoUtcDay(hasta),
  };
}
