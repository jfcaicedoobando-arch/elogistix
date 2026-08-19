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
