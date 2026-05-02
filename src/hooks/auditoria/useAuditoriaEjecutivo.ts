/**
 * Vista ejecutiva de auditoría operativa — derivaciones agregadas para el
 * director general. Reusa la query del reporte y de revisiones (no agrega
 * round-trips) y produce indicadores de salud, distribución y rankings.
 *
 * NOTA: Mientras no exista una tabla `auditoria_snapshots` con histórico
 * diario, la "tendencia 30d" no es calculable de forma exacta. Aquí se
 * exponen métricas que sí se pueden derivar del estado actual sin inventar
 * datos: score de salud, % atendidos, edad promedio de pendientes, top
 * clientes, distribución por etapa y por regla.
 */
import { useMemo } from "react";
import { useAuditoria } from "@/hooks/auditoria/useAuditoria";
import {
  revisionKey,
  useAuditoriaRevisiones,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

export interface AuditoriaEjecutivoData {
  isLoading: boolean;
  /** Total bruto de hallazgos detectados por la RPC. */
  totalHallazgos: number;
  /** Hallazgos pendientes (no marcados como revisados). */
  pendientes: HallazgoAuditoria[];
  totalPendientes: number;
  totalRevisados: number;
  /**
   * Score 0-100 de salud operativa basado en pendientes ponderados por severidad.
   *  - 100 = sin pendientes
   *  - <60 = atención inmediata
   * Fórmula: 100 - min(100, suma_ponderada * 2), donde
   * crítico=5, alto=2, medio=1.
   */
  score: number;
  scoreEstado: "excelente" | "bueno" | "regular" | "malo";
  /** % de hallazgos ya atendidos (revisados/total). */
  porcentajeAtendidos: number;
  /** Conteo de pendientes por severidad. */
  porSeveridad: Record<SeveridadAuditoria, number>;
  /** Conteo de pendientes por regla. */
  porRegla: Record<ReglaAuditoria, number>;
  /** Conteo de pendientes por estado del embarque (etapa del ciclo). */
  porEtapa: Array<{ etapa: string; total: number; criticos: number }>;
  /** Top clientes con más pendientes (máx N). */
  topClientes: Array<{ cliente: string; total: number; criticos: number }>;
  /** Hallazgos pendientes con ETA vencida o muy próxima (≤ 3 días). */
  pendientesUrgentesPorEta: number;
  /** Hallazgos pendientes con ETA ya pasada (vencidos). */
  pendientesVencidos: number;
  /** Edad promedio en días de los hallazgos pendientes con ETA conocida. */
  edadPromediaPendientesDias: number | null;
  /** Última generación del reporte. */
  generadoEn: string | null;
}

const PESOS: Record<SeveridadAuditoria, number> = {
  critico: 5,
  alto: 2,
  medio: 1,
};

const TOP_N = 5;

export function useAuditoriaEjecutivo(): AuditoriaEjecutivoData {
  const { data, isLoading } = useAuditoria();
  const { data: revisiones } = useAuditoriaRevisiones();

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

    // Score ponderado.
    let suma = 0;
    const porSeveridad: Record<SeveridadAuditoria, number> = {
      critico: 0,
      alto: 0,
      medio: 0,
    };
    const porRegla: Record<ReglaAuditoria, number> = {
      docs_faltantes: 0,
      docs_pendientes_avanzado: 0,
      fechas: 0,
      ventas_sin_facturar: 0,
      margen_negativo: 0,
      margen_bajo: 0,
      venta_sin_costo: 0,
      costo_sin_venta: 0,
      proforma_vencida: 0,
      embarque_huerfano: 0,
    };
    for (const h of pendientes) {
      suma += PESOS[h.severidad];
      porSeveridad[h.severidad]++;
      porRegla[h.regla]++;
    }
    const penalizacion = Math.min(100, suma * 2);
    const score = totalPendientes === 0 ? 100 : Math.max(0, Math.round(100 - penalizacion));
    const scoreEstado: AuditoriaEjecutivoData["scoreEstado"] =
      score >= 90 ? "excelente"
      : score >= 75 ? "bueno"
      : score >= 60 ? "regular"
      : "malo";

    // Por etapa: agrupar por estado del embarque.
    const etapaMap = new Map<string, { total: number; criticos: number }>();
    for (const h of pendientes) {
      const e = h.estado || "—";
      const cur = etapaMap.get(e) ?? { total: 0, criticos: 0 };
      cur.total++;
      if (h.severidad === "critico") cur.criticos++;
      etapaMap.set(e, cur);
    }
    const porEtapa = Array.from(etapaMap.entries())
      .map(([etapa, v]) => ({ etapa, total: v.total, criticos: v.criticos }))
      .sort((a, b) => b.total - a.total);

    // Top clientes.
    const cliMap = new Map<string, { total: number; criticos: number }>();
    for (const h of pendientes) {
      const c = h.cliente_nombre || "Sin cliente";
      const cur = cliMap.get(c) ?? { total: 0, criticos: 0 };
      cur.total++;
      if (h.severidad === "critico") cur.criticos++;
      cliMap.set(c, cur);
    }
    const topClientes = Array.from(cliMap.entries())
      .map(([cliente, v]) => ({ cliente, total: v.total, criticos: v.criticos }))
      .sort((a, b) => b.criticos - a.criticos || b.total - a.total)
      .slice(0, TOP_N);

    // Urgencia por ETA.
    const hoyIso = new Date().toISOString().slice(0, 10);
    const en3dias = new Date();
    en3dias.setDate(en3dias.getDate() + 3);
    const en3DiasIso = en3dias.toISOString().slice(0, 10);

    let pendientesVencidos = 0;
    let pendientesUrgentesPorEta = 0;
    let sumaDias = 0;
    let countDias = 0;
    for (const h of pendientes) {
      if (!h.eta) continue;
      if (h.eta < hoyIso) {
        pendientesVencidos++;
        // Edad = días desde ETA pasada hasta hoy.
        const dias = Math.floor(
          (Date.parse(hoyIso) - Date.parse(h.eta)) / (1000 * 60 * 60 * 24),
        );
        sumaDias += dias;
        countDias++;
      } else if (h.eta <= en3DiasIso) {
        pendientesUrgentesPorEta++;
      }
    }
    const edadPromediaPendientesDias = countDias > 0
      ? Math.round(sumaDias / countDias)
      : null;

    const generadoEn = data?.generated_at
      ? new Date(data.generated_at).toLocaleString("es-MX", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null;

    return {
      isLoading,
      totalHallazgos,
      pendientes,
      totalPendientes,
      totalRevisados,
      score,
      scoreEstado,
      porcentajeAtendidos,
      porSeveridad,
      porRegla,
      porEtapa,
      topClientes,
      pendientesUrgentesPorEta,
      pendientesVencidos,
      edadPromediaPendientesDias,
      generadoEn,
    };
  }, [data, revisiones, isLoading]);
}
