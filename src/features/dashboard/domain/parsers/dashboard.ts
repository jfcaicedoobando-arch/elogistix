/**
 * Pure parsers for the `dashboard_stats()` JSONB RPC payload.
 * Extracted from useDashboardData to keep the hook focused on query+state.
 *
 * Validación runtime (P1.7): usa `safeParse` de los schemas en
 * `./dashboardSchemas`. Si falla, cae al EMPTY_* correspondiente para
 * preservar la resiliencia visual del dashboard.
 */

import {
  EMPTY_ARRIBOS,
  EMPTY_CONTEO,
  EMPTY_RESUMEN,
  type ArribosEsteMes,
  type CargaPorCliente,
  type DashboardStats,
  type EmbarqueConEstado,
  type EmbarqueConProfit,
  type EmbarqueMesSiguiente,
  type EstadoFiltro,
  type ResumenFacturacion,
} from "./dashboardTypes";

import {
  arribosEsteMesSchema,
  resumenMesSiguienteSchema,
  cargaPorClienteSchema,
} from "./dashboardSchemas";

export * from "./dashboardTypes";

export function parseConteoPorEstado(stats: DashboardStats): Record<EstadoFiltro, number> {
  if (!stats?.conteoPorEstado) return EMPTY_CONTEO;
  const raw = stats.conteoPorEstado as Record<string, number>;
  // v13.303.22 — `Llegada` (deprecado) se suma a `Arribo` para no perder conteos legacy.
  return {
    Confirmado: Number(raw["Confirmado"] ?? 0),
    "En Tránsito": Number(raw["En Tránsito"] ?? 0),
    // v13.303.41 — `En Proceso` fue removido del filtro visual del dashboard.
    Arribo: Number(raw["Arribo"] ?? 0) + Number(raw["Llegada"] ?? 0),
    "En Aduana": Number(raw["En Aduana"] ?? 0),
    Entregado: Number(raw["Entregado"] ?? 0),
    EIR: Number(raw["EIR"] ?? 0),
  };
}

export function parseArribosEsteMes(stats: DashboardStats): ArribosEsteMes {
  if (!stats?.arribosEsteMes) return EMPTY_ARRIBOS;
  const result = arribosEsteMesSchema.safeParse(stats.arribosEsteMes);
  if (!result.success) return EMPTY_ARRIBOS;
  const r = result.data;
  return {
    total: r.total,
    yaLlegaron: r.yaLlegaron,
    enCamino: r.enCamino,
    profitUSD: r.profitUSD,
    ventaMXN: r.ventaMXN,
    costoMXN: r.costoMXN,
    profitMXN: r.profitMXN,
    ventaMxnFromUsd: r.ventaMxnFromUsd,
    costoMxnFromUsd: r.costoMxnFromUsd,
    ventaMxnFromEur: r.ventaMxnFromEur,
    costoMxnFromEur: r.costoMxnFromEur,
    ventaMxnNative: r.ventaMxnNative,
    costoMxnNative: r.costoMxnNative,
    gastosOperativosMXN: r.gastosOperativosMXN,
  };
}

export function parseResumenMesSiguiente(stats: DashboardStats): ResumenFacturacion {
  if (!stats?.resumenMesSiguiente) return EMPTY_RESUMEN;
  const result = resumenMesSiguienteSchema.safeParse(stats.resumenMesSiguiente);
  if (!result.success) return EMPTY_RESUMEN;
  const r = result.data;
  return {
    totalEmbarques: r.totalEmbarques,
    ventaUSD: r.ventaUSD,
    costoUSD: r.costoUSD,
    profitUSD: r.profitUSD,
    ventaMXN: r.ventaMXN,
    costoMXN: r.costoMXN,
    profitMXN: r.profitMXN,
    facturados: r.facturados,
    nombreMes: r.nombreMes,
  };
}

// Re-export para no romper consumidores existentes
;
import { parseEmbarqueConProfitRaw } from "./dashboardProfit";

export function parseEmbarquesMesSiguiente(stats: DashboardStats): EmbarqueMesSiguiente[] {
  const raw = (stats?.embarquesMesSiguiente as Array<Record<string, unknown>>) ?? [];
  return raw.map((r) => ({
    ...parseEmbarqueConProfitRaw(r),
    facturado: Boolean(r.facturado ?? false),
  }));
}

export function parseProfitArribosEsteMes(stats: DashboardStats): EmbarqueConProfit[] {
  const raw = (stats?.profitArribosEsteMes as Array<Record<string, unknown>>) ?? [];
  return raw.map(parseEmbarqueConProfitRaw);
}

export function parseCargasActivasTotal(stats: DashboardStats): number {
  const v = stats?.cargasActivasTotal;
  return typeof v === "number" ? v : Number(v ?? 0);
}

/**
 * v13.303.13 · Listado ligero de embarques EIR expuesto por `dashboard_details()`
 * para que el scope "mis embarques" pueda contarlos por operador. EIR está
 * excluido del CTE `activos` del RPC, así que este es el único canal.
 */
export type EmbarqueEirLite = {
  id: string;
  operador: string | null;
  estadoReal: "EIR";
};

export function parseEmbarquesEir(stats: DashboardStats): EmbarqueEirLite[] {
  const raw = stats?.embarquesEir;
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter((r) => r && typeof r.id === "string")
    .map((r) => ({
      id: String(r.id),
      operador: r.operador == null ? null : String(r.operador),
      estadoReal: "EIR" as const,
    }));
}

export function parseCargasPorCliente(stats: DashboardStats): CargaPorCliente[] {
  if (!stats?.cargasPorCliente) return [];
  const raw = stats.cargasPorCliente;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): CargaPorCliente[] => {
    const result = cargaPorClienteSchema.safeParse(entry);
    if (!result.success) return [];
    const r = result.data;
    const d = r.desglose ?? {};
    return [{
      clienteId: String(r.clienteId ?? r.cliente_id ?? ""),
      clienteNombre: String(r.clienteNombre ?? r.cliente_nombre ?? "Sin cliente"),
      total: r.total,
      desglose: {
        Confirmado: Number(d.Confirmado ?? 0),
        "En Tránsito": Number(d["En Tránsito"] ?? 0),
        Arribo: Number(d.Arribo ?? 0),
        "En Aduana": Number(d["En Aduana"] ?? 0),
        Entregado: Number(d.Entregado ?? 0),
      },
    }];
  });
}

/** Combina y deduplica los embarques presentes en los distintos cortes del dashboard. */
export function combinarActivos(
  ...listas: EmbarqueConEstado[][]
): EmbarqueConEstado[] {
  const seen = new Set<string>();
  const out: EmbarqueConEstado[] = [];
  for (const lista of listas) {
    for (const e of lista) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}
