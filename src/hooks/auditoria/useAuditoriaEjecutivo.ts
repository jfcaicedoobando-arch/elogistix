/**
 * Vista ejecutiva de auditoría operativa — derivaciones agregadas para el
 * director general. Reusa la query del reporte y de revisiones (no agrega
 * round-trips) y produce indicadores de salud, distribución, fugas
 * financieras y productividad de operadores.
 */
import { useMemo } from "react";
import { useAuditoria } from "@/hooks/auditoria/useAuditoria";
import {
  revisionKey,
  useAuditoriaRevisiones,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import type {
  AuditoriaRevision,
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

export interface OperadorRanking {
  email: string;
  resueltos: number;
  pendientes: number;
  vencidos: number;
}

export interface AuditoriaEjecutivoData {
  isLoading: boolean;
  totalHallazgos: number;
  pendientes: HallazgoAuditoria[];
  totalPendientes: number;
  totalRevisados: number;
  /**
   * Score 0-100 de salud operativa basado en pendientes ponderados por severidad.
   *  - 100 = sin pendientes
   *  - <60 = atención inmediata
   * Pesos: crítico=5, alto=2, medio=1.
   */
  score: number;
  scoreEstado: "excelente" | "bueno" | "regular" | "malo";
  porcentajeAtendidos: number;
  porSeveridad: Record<SeveridadAuditoria, number>;
  porRegla: Record<ReglaAuditoria, number>;
  porEtapa: Array<{ etapa: string; total: number; criticos: number }>;
  topClientes: Array<{ cliente: string; total: number; criticos: number }>;
  pendientesUrgentesPorEta: number;
  pendientesVencidos: number;
  edadPromediaPendientesDias: number | null;
  /** Suma MXN de hallazgos financieros pendientes (margen negativo + bajo + proforma vencida). */
  riesgoFinancieroMxn: number;
  riesgoPorRegla: Partial<Record<ReglaAuditoria, number>>;
  /** Mean Time To Resolution en horas (revisado.updated_at - asignado_at). */
  mttrHoras: number | null;
  /** Top operadores ordenados por hallazgos resueltos. */
  rankingOperadores: OperadorRanking[];
  generadoEn: string | null;
}

const PESOS: Record<SeveridadAuditoria, number> = {
  critico: 5,
  alto: 2,
  medio: 1,
};

const REGLAS_FINANCIERAS: ReglaAuditoria[] = [
  "margen_negativo",
  "margen_bajo",
  "proforma_vencida",
];

const TOP_N = 5;

function diffHoras(desde: string, hasta: string): number {
  return (Date.parse(hasta) - Date.parse(desde)) / (1000 * 60 * 60);
}

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

    let suma = 0;
    const porSeveridad: Record<SeveridadAuditoria, number> = {
      critico: 0, alto: 0, medio: 0,
    };
    const porRegla: Record<ReglaAuditoria, number> = {
      docs_faltantes: 0, docs_pendientes_avanzado: 0, fechas: 0,
      ventas_sin_facturar: 0, margen_negativo: 0, margen_bajo: 0,
      venta_sin_costo: 0, costo_sin_venta: 0, proforma_vencida: 0,
      embarque_huerfano: 0,
    };
    const riesgoPorRegla: Partial<Record<ReglaAuditoria, number>> = {};
    let riesgoFinancieroMxn = 0;
    for (const h of pendientes) {
      suma += PESOS[h.severidad];
      porSeveridad[h.severidad]++;
      porRegla[h.regla]++;
      if (REGLAS_FINANCIERAS.includes(h.regla) && typeof h.monto_mxn === "number") {
        const monto = Math.max(0, h.monto_mxn);
        riesgoFinancieroMxn += monto;
        riesgoPorRegla[h.regla] = (riesgoPorRegla[h.regla] ?? 0) + monto;
      }
    }
    const penalizacion = Math.min(100, suma * 2);
    const score = totalPendientes === 0 ? 100 : Math.max(0, Math.round(100 - penalizacion));
    const scoreEstado: AuditoriaEjecutivoData["scoreEstado"] =
      score >= 90 ? "excelente"
      : score >= 75 ? "bueno"
      : score >= 60 ? "regular"
      : "malo";

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

    /* ───────────────── MTTR + ranking de operadores ───────────────── */
    const opMap = new Map<string, OperadorRanking>();
    let mttrSuma = 0;
    let mttrCount = 0;
    if (revisiones) {
      for (const r of revisiones.values() as IterableIterator<AuditoriaRevision>) {
        const email = r.responsable_email || r.revisado_por_email || "Sin asignar";
        const cur = opMap.get(email) ?? {
          email,
          resueltos: 0,
          pendientes: 0,
          vencidos: 0,
        };
        if (r.estado_revision === "revisado") {
          cur.resueltos++;
          if (r.asignado_at) {
            const horas = diffHoras(r.asignado_at, r.updated_at);
            if (horas >= 0 && horas < 24 * 90) {
              mttrSuma += horas;
              mttrCount++;
            }
          }
        } else {
          cur.pendientes++;
          if (r.fecha_limite && r.fecha_limite < hoyIso) cur.vencidos++;
        }
        opMap.set(email, cur);
      }
    }
    const mttrHoras = mttrCount > 0 ? Math.round(mttrSuma / mttrCount) : null;
    const rankingOperadores = Array.from(opMap.values())
      .filter((o) => o.email !== "Sin asignar" || o.pendientes > 0)
      .sort(
        (a, b) =>
          b.resueltos - a.resueltos ||
          b.pendientes - a.pendientes,
      )
      .slice(0, TOP_N);

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
      riesgoFinancieroMxn,
      riesgoPorRegla,
      mttrHoras,
      rankingOperadores,
      generadoEn,
    };
  }, [data, revisiones, isLoading]);
}
