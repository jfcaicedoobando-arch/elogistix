/**
 * Agregados puros del módulo "Auditoría Ejecutivo".
 * Extraídos de `useAuditoriaEjecutivo` (11.14.0).
 */
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/features/auditoria/types";
import { SCORE_THRESHOLDS } from "@/features/auditoria/constants";

// `OperadorRanking` / `calcularRanking` viven en `./ejecutivoRanking` (split Power-of-10 #4).
export { calcularRanking, type OperadorRanking, type RankingResultado } from "./ejecutivoRanking";

export type ScoreEstado = "excelente" | "bueno" | "regular" | "malo";

export const PESOS: Record<SeveridadAuditoria, number> = {
  critico: 5,
  alto: 2,
  medio: 1,
};

export const REGLAS_FINANCIERAS: ReglaAuditoria[] = [
  "margen_negativo",
  "margen_bajo",
  "proforma_vencida",
];

export const TOP_N = 5;

export function diffHoras(desde: string, hasta: string): number {
  return (Date.parse(hasta) - Date.parse(desde)) / (1000 * 60 * 60);
}

export function emptyPorRegla(): Record<ReglaAuditoria, number> {
  return {
    docs_faltantes: 0, docs_pendientes_avanzado: 0, fechas: 0,
    ventas_sin_facturar: 0, margen_negativo: 0, margen_bajo: 0,
    venta_sin_costo: 0, costo_sin_venta: 0, proforma_vencida: 0,
    proforma_borrador_abandonada: 0, proforma_inconsistente: 0,
    embarque_huerfano: 0,
    factura_sin_timbrar: 0, rep_pendiente: 0,
    factura_cancelada_sin_sustitucion: 0,
    cxc_vencida: 0,
    cxp_por_capturar_estancada: 0,
    cxp_vencida: 0,
  };
}

export interface AgregadoBase {
  porSeveridad: Record<SeveridadAuditoria, number>;
  porRegla: Record<ReglaAuditoria, number>;
  riesgoFinancieroMxn: number;
  riesgoPorRegla: Partial<Record<ReglaAuditoria, number>>;
  suma: number;
}

export function agregarPendientes(pendientes: HallazgoAuditoria[]): AgregadoBase {
  const out: AgregadoBase = {
    porSeveridad: { critico: 0, alto: 0, medio: 0 },
    porRegla: emptyPorRegla(),
    riesgoFinancieroMxn: 0,
    riesgoPorRegla: {},
    suma: 0,
  };
  for (const h of pendientes) {
    out.suma += PESOS[h.severidad];
    out.porSeveridad[h.severidad]++;
    out.porRegla[h.regla]++;
    if (REGLAS_FINANCIERAS.includes(h.regla) && typeof h.monto_mxn === "number") {
      const monto = Math.max(0, h.monto_mxn);
      out.riesgoFinancieroMxn += monto;
      out.riesgoPorRegla[h.regla] = (out.riesgoPorRegla[h.regla] ?? 0) + monto;
    }
  }
  return out;
}

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

/**
 * Compara el score actual contra el snapshot más cercano a `diasAtras`
 * (default 7). Retorna `null` si no hay snapshot comparable.
 */
export interface RegresionScore {
  scoreAnterior: number;
  diferencia: number; // positivo = mejoró, negativo = empeoró
  fechaAnterior: string;
}

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
  // Si el snapshot más cercano está a > 3 días del objetivo, descartamos
  // (no es suficientemente representativo de "hace una semana").
  if (mejorDelta > 3 * 86_400_000) return null;
  return {
    scoreAnterior: mejor.score,
    diferencia: scoreActual - mejor.score,
    fechaAnterior: mejor.fecha,
  };
}


export function agruparPorEtapaYCliente(pendientes: HallazgoAuditoria[]) {
  const etapaMap = new Map<string, { total: number; criticos: number }>();
  const cliMap = new Map<string, { total: number; criticos: number }>();
  for (const h of pendientes) {
    const e = h.estado || "—";
    const curE = etapaMap.get(e) ?? { total: 0, criticos: 0 };
    curE.total++;
    if (h.severidad === "critico") curE.criticos++;
    etapaMap.set(e, curE);

    const c = h.cliente_nombre || "Sin cliente";
    const curC = cliMap.get(c) ?? { total: 0, criticos: 0 };
    curC.total++;
    if (h.severidad === "critico") curC.criticos++;
    cliMap.set(c, curC);
  }
  const porEtapa = Array.from(etapaMap.entries())
    .map(([etapa, v]) => ({ etapa, total: v.total, criticos: v.criticos }))
    .sort((a, b) => b.total - a.total);
  const topClientes = Array.from(cliMap.entries())
    .map(([cliente, v]) => ({ cliente, total: v.total, criticos: v.criticos }))
    .sort((a, b) => b.criticos - a.criticos || b.total - a.total)
    .slice(0, TOP_N);
  return { porEtapa, topClientes };
}

export function calcularVencimientos(pendientes: HallazgoAuditoria[]) {
  // UTC-only: evita drift por TZ local (ver banner core.ts).
  const nowMs = Date.now();
  const hoyIso = new Date(nowMs).toISOString().slice(0, 10);
  const en3DiasIso = new Date(nowMs + 3 * 86_400_000).toISOString().slice(0, 10);
  let pendientesVencidos = 0;
  let pendientesUrgentesPorEta = 0;
  let sumaDias = 0;
  let countDias = 0;
  for (const h of pendientes) {
    if (!h.eta) continue;
    if (h.eta < hoyIso) {
      pendientesVencidos++;
      const dias = Math.floor((Date.parse(hoyIso) - Date.parse(h.eta)) / 86_400_000);
      sumaDias += dias;
      countDias++;
    } else if (h.eta <= en3DiasIso) {
      pendientesUrgentesPorEta++;
    }
  }
  const edadPromediaPendientesDias = countDias > 0 ? Math.round(sumaDias / countDias) : null;
  return { hoyIso, pendientesVencidos, pendientesUrgentesPorEta, edadPromediaPendientesDias };
}

