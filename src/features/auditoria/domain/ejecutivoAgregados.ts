/**
 * Agregados puros del módulo "Auditoría Ejecutivo".
 * Extraídos de `useAuditoriaEjecutivo` (11.14.0).
 */
import type {
  AuditoriaRevision,
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/features/auditoria/types";
import { SCORE_THRESHOLDS } from "@/features/auditoria/constants";

export interface OperadorRanking {
  email: string;
  resueltos: number;
  pendientes: number;
  vencidos: number;
}

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

export function calcularScore(
  suma: number,
  totalPendientes: number,
): { score: number; scoreEstado: ScoreEstado } {
  const penalizacion = Math.min(100, suma * 2);
  const score = totalPendientes === 0 ? 100 : Math.max(0, Math.round(100 - penalizacion));
  const scoreEstado: ScoreEstado =
    score >= SCORE_THRESHOLDS.EXCELENTE ? "excelente"
    : score >= SCORE_THRESHOLDS.BUENO ? "bueno"
    : score >= SCORE_THRESHOLDS.REGULAR ? "regular"
    : "malo";
  return { score, scoreEstado };
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

/**
 * Acumula la revisión en el ranking de un email particular y en el accumulator
 * de MTTR. Usa `revisado_at` (no `updated_at`) para que comentarios o
 * reasignaciones posteriores no distorsionen la métrica.
 */
function procesarRevisionEnOperador(
  r: AuditoriaRevision,
  cur: OperadorRanking,
  hoyIso: string,
  acc: { suma: number; count: number },
): void {
  if (r.estado_revision === "revisado") {
    cur.resueltos++;
    if (r.asignado_at && r.revisado_at) {
      const horas = diffHoras(r.asignado_at, r.revisado_at);
      if (horas >= 0 && horas < 24 * 90) {
        acc.suma += horas;
        acc.count++;
      }
    }
  } else {
    cur.pendientes++;
    if (r.fecha_limite && r.fecha_limite < hoyIso) cur.vencidos++;
  }
}

export interface RankingResultado {
  mttrHoras: number | null;
  rankingResponsables: OperadorRanking[];
  rankingRevisores: OperadorRanking[];
  /** Alias retrocompatible — usar `rankingResponsables` en código nuevo. */
  rankingOperadores: OperadorRanking[];
}

/**
 * Calcula MTTR + dos rankings independientes:
 *  - `rankingResponsables`: por `responsable_email` (quién tiene asignado el hallazgo)
 *  - `rankingRevisores`: por `revisado_por_email` (quién marcó "revisado")
 *
 * Antes se mezclaban en una sola clave (`responsable_email || revisado_por_email`)
 * y producía métricas ambiguas cuando A asignaba y B resolvía.
 */
export function calcularRanking(
  revisiones: Map<string, AuditoriaRevision> | undefined,
  hoyIso: string,
): RankingResultado {
  const responsablesMap = new Map<string, OperadorRanking>();
  const revisoresMap = new Map<string, OperadorRanking>();
  const mttrAcc = { suma: 0, count: 0 };
  if (revisiones) {
    for (const r of revisiones.values()) {
      const respEmail = r.responsable_email || "Sin asignar";
      const resp = responsablesMap.get(respEmail) ?? { email: respEmail, resueltos: 0, pendientes: 0, vencidos: 0 };
      procesarRevisionEnOperador(r, resp, hoyIso, mttrAcc);
      responsablesMap.set(respEmail, resp);

      if (r.estado_revision === "revisado" && r.revisado_por_email) {
        const rev = revisoresMap.get(r.revisado_por_email) ?? {
          email: r.revisado_por_email, resueltos: 0, pendientes: 0, vencidos: 0,
        };
        rev.resueltos++;
        revisoresMap.set(r.revisado_por_email, rev);
      }
    }
  }
  const mttrHoras = mttrAcc.count > 0 ? Math.round(mttrAcc.suma / mttrAcc.count) : null;
  const rankingResponsables = Array.from(responsablesMap.values())
    .filter((o) => o.email !== "Sin asignar" || o.pendientes > 0)
    .sort((a, b) => b.resueltos - a.resueltos || b.pendientes - a.pendientes)
    .slice(0, TOP_N);
  const rankingRevisores = Array.from(revisoresMap.values())
    .sort((a, b) => b.resueltos - a.resueltos)
    .slice(0, TOP_N);
  return {
    mttrHoras,
    rankingResponsables,
    rankingRevisores,
    rankingOperadores: rankingResponsables, // alias retrocompatible
  };
}
