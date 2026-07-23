/**
 * Ranking de operadores y MTTR para Auditoría Ejecutivo.
 * Extraído de `ejecutivoAgregados.ts` para mantener archivos ≤200 líneas.
 */
import type { AuditoriaRevision } from "@/features/auditoria/types";
import { diffHoras, TOP_N } from "./ejecutivoRankingCore";

export interface OperadorRanking {
  email: string;
  resueltos: number;
  pendientes: number;
  vencidos: number;
}

export interface RankingResultado {
  mttrHoras: number | null;
  rankingResponsables: OperadorRanking[];
  rankingRevisores: OperadorRanking[];
  /** Alias retrocompatible — usar `rankingResponsables` en código nuevo. */
  rankingOperadores: OperadorRanking[];
}

/**
 * Acumula la revisión en el ranking de un email particular y en el accumulator
 * de MTTR. Usa `revisado_at` (no `updated_at`) para que comentarios o
 * reasignaciones posteriores no distorsionen la métrica. Como punto de inicio
 * usa `asignado_at` cuando existe, y hace fallback a `created_at` (fecha en
 * que se detectó el hallazgo) porque la asignación explícita es opcional
 * en el flujo actual y sin fallback el promedio nunca acumula muestras.
 */
function procesarRevisionEnOperador(
  r: AuditoriaRevision,
  cur: OperadorRanking,
  hoyIso: string,
  acc: { suma: number; count: number },
): void {
  if (r.estado_revision === "revisado") {
    cur.resueltos++;
    const inicio = r.asignado_at ?? r.created_at;
    if (inicio && r.revisado_at) {
      const horas = diffHoras(inicio, r.revisado_at);
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


/**
 * Calcula MTTR + dos rankings independientes:
 *  - `rankingResponsables`: por `responsable_email` (quién tiene asignado el hallazgo)
 *  - `rankingRevisores`: por `revisado_por_email` (quién marcó "revisado")
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
    rankingOperadores: rankingResponsables,
  };
}
