/**
 * Score y regresión del módulo "Auditoría Ejecutivo" (Fase 3).
 * Split desde `ejecutivoAgregados.ts` para respetar Power-of-10 #4 (≤200 líneas).
 */
import { SCORE_THRESHOLDS } from "@/features/auditoria/constants";

export type ScoreEstado = "excelente" | "bueno" | "regular" | "malo";

/**
 * Umbral de fuga financiera a partir del cual el componente económico del
 * score llega a 0. 500k MXN ≈ pérdida significativa para una PYME logística.
 */
export const RIESGO_UMBRAL_MXN = 500_000;

/**
 * Score 60/40 (Fase 3): 60 % impacto económico (riesgo MXN) + 40 % higiene
 * operativa (pesos por severidad). Si `riesgoMxn <= 0` se conserva el
 * comportamiento histórico (sólo higiene) para no inflar tenants sin reglas
 * financieras emitidas.
 */
export function calcularScore(
  suma: number,
  totalPendientes: number,
  riesgoMxn = 0,
): { score: number; scoreEstado: ScoreEstado } {
  if (totalPendientes === 0) {
    return { score: 100, scoreEstado: "excelente" };
  }
  const higiene = Math.max(0, 100 - Math.min(100, suma * 2));
  let score: number;
  if (riesgoMxn <= 0) {
    score = Math.round(higiene);
  } else {
    const economico = Math.max(
      0,
      100 - Math.min(100, (riesgoMxn / RIESGO_UMBRAL_MXN) * 100),
    );
    score = Math.round(0.4 * higiene + 0.6 * economico);
  }
  const scoreEstado: ScoreEstado =
    score >= SCORE_THRESHOLDS.EXCELENTE ? "excelente"
    : score >= SCORE_THRESHOLDS.BUENO ? "bueno"
    : score >= SCORE_THRESHOLDS.REGULAR ? "regular"
    : "malo";
  return { score, scoreEstado };
}

export interface RegresionScore {
  scoreAnterior: number;
  diferencia: number; // positivo = mejoró, negativo = empeoró
  fechaAnterior: string;
}

/**
 * Compara el score actual contra el snapshot más cercano a `diasAtras`
 * (default 7). Retorna `null` si no hay snapshot comparable dentro de ±3 días.
 */
export function calcularRegresion(
  scoreActual: number,
  snapshots: Array<{ fecha: string; score: number }>,
  diasAtras = 7,
): RegresionScore | null {
  if (!snapshots.length) return null;
  const objetivoMs = Date.now() - diasAtras * 86_400_000;
  let mejor: { fecha: string; score: number } | null = null;
  let mejorDelta = Infinity;
  for (const s of snapshots) {
    const delta = Math.abs(Date.parse(`${s.fecha}T00:00:00Z`) - objetivoMs);
    if (delta < mejorDelta) {
      mejorDelta = delta;
      mejor = s;
    }
  }
  if (!mejor) return null;
  if (mejorDelta > 3 * 86_400_000) return null;
  return {
    scoreAnterior: mejor.score,
    diferencia: scoreActual - mejor.score,
    fechaAnterior: mejor.fecha,
  };
}
