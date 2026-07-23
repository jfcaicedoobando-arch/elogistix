/**
 * Vista ejecutiva de auditoría operativa — derivaciones agregadas para el
 * director general. Reusa la query del reporte y de revisiones (no agrega
 * round-trips) y produce indicadores de salud, distribución, fugas
 * financieras y productividad de operadores.
 *
 * 11.14.0: agregados puros extraídos a `lib/auditoria/ejecutivoAgregados`.
 */
import { useMemo } from "react";
import { formatFechaHora } from "@/lib/formatters/dates";
import { useAuditoria } from "@/features/auditoria/hooks/useAuditoria";
import {
  revisionKey,
  useAuditoriaRevisiones,
} from "@/features/auditoria/hooks/useAuditoriaRevisiones";
import { useAuditoriaSnapshots } from "@/features/auditoria/hooks/useAuditoriaSnapshots";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/features/auditoria/types";
import {
  agregarPendientes,
  calcularScore,
  calcularRegresion,
  agruparPorEtapaYCliente,
  calcularVencimientos,
  calcularRanking,
  type OperadorRanking,
  type RegresionScore,
  type ScoreEstado,
} from "@/features/auditoria/domain/ejecutivoAgregados";


export interface AuditoriaEjecutivoData {
  isLoading: boolean;
  totalHallazgos: number;
  pendientes: HallazgoAuditoria[];
  totalPendientes: number;
  totalRevisados: number;
  score: number;
  scoreEstado: ScoreEstado;
  porcentajeAtendidos: number;
  porSeveridad: Record<SeveridadAuditoria, number>;
  porRegla: Record<ReglaAuditoria, number>;
  porEtapa: Array<{ etapa: string; total: number; criticos: number }>;
  topClientes: Array<{ cliente: string; total: number; criticos: number }>;
  pendientesUrgentesPorEta: number;
  pendientesVencidos: number;
  edadPromediaPendientesDias: number | null;
  riesgoFinancieroMxn: number;
  riesgoPorRegla: Partial<Record<ReglaAuditoria, number>>;
  mttrHoras: number | null;
  rankingOperadores: OperadorRanking[];
  rankingRevisores: OperadorRanking[];
  /** Regresión vs snapshot de hace ~7 días. `null` si no hay histórico. */
  regresion7d: RegresionScore | null;
  generadoEn: string | null;
}

export type { OperadorRanking, RegresionScore };

export function useAuditoriaEjecutivo(): AuditoriaEjecutivoData {
  const { data, isLoading } = useAuditoria();
  const { data: revisiones } = useAuditoriaRevisiones();
  const { data: snapshots } = useAuditoriaSnapshots(14);

  return useMemo(() => {
    const todos = data?.hallazgos ?? [];
    const totalHallazgos = todos.length;
    const pendientes = revisiones && revisiones.size > 0
      ? todos.filter((h) => !revisiones.has(revisionKey(h)))
      : todos;
    const totalPendientes = pendientes.length;
    const totalRevisados = totalHallazgos - totalPendientes;
    const porcentajeAtendidos = totalHallazgos === 0
      ? 100
      : Math.round((totalRevisados / totalHallazgos) * 100);

    const agg = agregarPendientes(pendientes);
    const { score, scoreEstado } = calcularScore(
      agg.suma,
      totalPendientes,
      agg.riesgoFinancieroMxn,
    );
    const { porEtapa, topClientes } = agruparPorEtapaYCliente(pendientes);
    const venc = calcularVencimientos(pendientes);
    const { mttrHoras, rankingOperadores, rankingRevisores } = calcularRanking(revisiones, venc.hoyIso);
    const regresion7d = calcularRegresion(
      score,
      (snapshots ?? []).map((s) => ({ fecha: s.fecha, score: s.score })),
      7,
    );

    const generadoEn = data?.generated_at
      ? formatFechaHora(data.generated_at)
      : null;

    return {
      isLoading, totalHallazgos, pendientes, totalPendientes, totalRevisados,
      score, scoreEstado, porcentajeAtendidos,
      porSeveridad: agg.porSeveridad, porRegla: agg.porRegla,
      porEtapa, topClientes,
      pendientesUrgentesPorEta: venc.pendientesUrgentesPorEta,
      pendientesVencidos: venc.pendientesVencidos,
      edadPromediaPendientesDias: venc.edadPromediaPendientesDias,
      riesgoFinancieroMxn: agg.riesgoFinancieroMxn,
      riesgoPorRegla: agg.riesgoPorRegla,
      mttrHoras, rankingOperadores, rankingRevisores,
      regresion7d, generadoEn,
    };
  }, [data, revisiones, snapshots, isLoading]);
}

