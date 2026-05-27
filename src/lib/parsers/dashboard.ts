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
import { numOr0 } from "./dashboardProfit";
import {
  arribosEsteMesSchema,
  resumenMesSiguienteSchema,
  cargaPorClienteSchema,
} from "./dashboardSchemas";

export * from "./dashboardTypes";

export function parseConteoPorEstado(stats: DashboardStats): Record<EstadoFiltro, number> {
  if (!stats?.conteoPorEstado) return EMPTY_CONTEO;
  const raw = stats.conteoPorEstado as Record<string, number>;
  return {
    Confirmado: Number(raw["Confirmado"] ?? 0),
    "En Tránsito": Number(raw["En Tránsito"] ?? 0),
    Arribo: Number(raw["Arribo"] ?? 0),
    "En Aduana": Number(raw["En Aduana"] ?? 0),
    Entregado: Number(raw["Entregado"] ?? 0),
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
  };
}

export function parseResumenMesSiguiente(stats: DashboardStats): ResumenFacturacion {
  if (!stats?.resumenMesSiguiente) return EMPTY_RESUMEN;
  const raw = stats.resumenMesSiguiente as Record<string, unknown>;
  return {
    totalEmbarques: Number(raw.totalEmbarques ?? 0),
    ventaUSD: Number(raw.ventaUSD ?? 0),
    costoUSD: Number(raw.costoUSD ?? 0),
    profitUSD: Number(raw.profitUSD ?? 0),
    ventaMXN: Number(raw.ventaMXN ?? 0),
    costoMXN: Number(raw.costoMXN ?? 0),
    profitMXN: Number(raw.profitMXN ?? 0),
    facturados: Number(raw.facturados ?? 0),
    nombreMes: String(raw.nombreMes ?? ""),
  };
}

// Re-export para no romper consumidores existentes
export { parseEmbarqueConProfitRaw } from "./dashboardProfit";
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

export function parseCargasPorCliente(stats: DashboardStats): CargaPorCliente[] {
  if (!stats?.cargasPorCliente) return [];
  const raw = stats.cargasPorCliente as Array<Record<string, unknown>>;
  return raw.map((r) => {
    const desgloseRaw = (r.desglose as Record<string, number> | undefined) ?? {};
    return {
      clienteId: String(r.clienteId ?? r.cliente_id ?? ""),
      clienteNombre: String(r.clienteNombre ?? r.cliente_nombre ?? "Sin cliente"),
      total: Number(r.total ?? 0),
      desglose: {
        Confirmado: Number(desgloseRaw["Confirmado"] ?? 0),
        "En Tránsito": Number(desgloseRaw["En Tránsito"] ?? 0),
        Arribo: Number(desgloseRaw["Arribo"] ?? 0),
        "En Aduana": Number(desgloseRaw["En Aduana"] ?? 0),
        Entregado: Number(desgloseRaw["Entregado"] ?? 0),
      },
    };
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
