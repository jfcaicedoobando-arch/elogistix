/**
 * Agregados puros del módulo "Auditoría Ejecutivo".
 * Extraídos de `useAuditoriaEjecutivo` (11.14.0).
 */
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/features/auditoria/types";
import { hoyMx } from "@/lib/date/mx";
import { TOP_N } from "./ejecutivoRankingCore";
import { diasVencidos } from "@/lib/date/dateOnly";

// `OperadorRanking` / `calcularRanking` viven en `./ejecutivoRanking` (split Power-of-10 #4).
export { calcularRanking, type OperadorRanking,  } from "./ejecutivoRanking";

// `calcularScore` / `calcularRegresion` / `RIESGO_UMBRAL_MXN` viven en `./ejecutivoScore` (split Power-of-10 #4).
export {
  calcularScore,
  calcularRegresion,
  RIESGO_UMBRAL_MXN,
  type ScoreEstado,
  type RegresionScore,
} from "./ejecutivoScore";


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

// `TOP_N` y `diffHoras` viven en `./ejecutivoRankingCore` (hoja pura, rompe ciclo con ranking).
;
export { TOP_N };

export function emptyPorRegla(): Record<ReglaAuditoria, number> {
  return {
    docs_faltantes: 0, docs_pendientes_avanzado: 0, fechas: 0,
    ventas_sin_facturar: 0, margen_negativo: 0, margen_bajo: 0,
    venta_sin_costo: 0, costo_sin_venta: 0, costos_repetidos: 0, proforma_vencida: 0,
    proforma_borrador_abandonada: 0, proforma_inconsistente: 0,
    embarque_huerfano: 0,
    factura_sin_timbrar: 0, rep_pendiente: 0,
    factura_cancelada_sin_sustitucion: 0,
    cxc_vencida: 0,
    cxp_por_capturar_estancada: 0,
    cxp_vencida: 0,
    contenedor_datos_incompletos: 0,
    contenedor_fechas_incompletas: 0, tipo_cambio_faltante: 0,
    venta_total_descuadrado: 0,
    contenedores_totales_descuadrados: 0,
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

/**
 * Reglas cuyo vencimiento NO depende del ETA del embarque (tienen su propio
 * calendario: crédito de proveedor, plazo de factura, expiración de proforma).
 * Se excluyen del bucket "ETA vencida" / "ETA en ≤ 3 días" para evitar
 * falsas urgencias — los pagos a proveedor suelen hacerse mucho después del
 * arribo.
 */
export const REGLAS_CON_VENCIMIENTO_PROPIO: ReglaAuditoria[] = [
  "cxp_por_capturar_estancada",
  "cxp_vencida",
  "cxc_vencida",
  "proforma_vencida",
  "proforma_borrador_abandonada",
];

/**
 * Fuente única de verdad del concepto "hallazgo con ETA vencida".
 * La tarjeta ejecutiva y el filtro de la tabla DEBEN usar este predicado para
 * que el conteo y el drill-down coincidan siempre.
 */
export function esHallazgoEtaVencida(h: HallazgoAuditoria, hoyIso: string): boolean {
  if (!h.eta) return false;
  if (REGLAS_CON_VENCIMIENTO_PROPIO.includes(h.regla)) return false;
  return h.eta < hoyIso;
}

/** Hoy en zona CDMX (misma base para tarjeta y tabla). */
export function hoyAuditoriaIso(base: Date = new Date()): string {
  return hoyMx(base);
}

export function calcularVencimientos(pendientes: HallazgoAuditoria[]) {
  // Zona CDMX: misma base de "hoy" que el filtro de la tabla (v13.322.17).
  const nowMs = Date.now();
  const hoyIso = hoyAuditoriaIso(new Date(nowMs));
  const en3DiasIso = hoyAuditoriaIso(new Date(nowMs + 3 * 86_400_000));
  let pendientesVencidos = 0;
  let pendientesUrgentesPorEta = 0;
  let sumaDias = 0;
  let countDias = 0;
  for (const h of pendientes) {
    if (!h.eta) continue;
    if (REGLAS_CON_VENCIMIENTO_PROPIO.includes(h.regla)) continue;
    if (esHallazgoEtaVencida(h, hoyIso)) {
      pendientesVencidos++;
      const dias = diasVencidos(h.eta, hoyIso);
      sumaDias += dias;
      countDias++;
    } else if (h.eta <= en3DiasIso) {
      pendientesUrgentesPorEta++;
    }
  }
  const edadPromediaPendientesDias = countDias > 0 ? Math.round(sumaDias / countDias) : null;
  return { hoyIso, pendientesVencidos, pendientesUrgentesPorEta, edadPromediaPendientesDias };
}


