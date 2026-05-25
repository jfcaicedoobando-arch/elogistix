/**
 * Pure parsers for the `dashboard_stats()` JSONB RPC payload.
 * Extracted from useDashboardData to keep the hook focused on query+state.
 */
import { fromDb } from "@/lib/supabase/cast";
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
  const raw = stats.arribosEsteMes as Record<string, number>;
  return {
    total: Number(raw.total ?? 0),
    yaLlegaron: Number(raw.yaLlegaron ?? 0),
    enCamino: Number(raw.enCamino ?? 0),
    profitUSD: Number(raw.profitUSD ?? 0),
    ventaMXN: Number(raw.ventaMXN ?? 0),
    costoMXN: Number(raw.costoMXN ?? 0),
    profitMXN: Number(raw.profitMXN ?? 0),
    ventaMxnFromUsd: Number(raw.ventaMxnFromUsd ?? 0),
    costoMxnFromUsd: Number(raw.costoMxnFromUsd ?? 0),
    ventaMxnFromEur: Number(raw.ventaMxnFromEur ?? 0),
    costoMxnFromEur: Number(raw.costoMxnFromEur ?? 0),
    ventaMxnNative: Number(raw.ventaMxnNative ?? 0),
    costoMxnNative: Number(raw.costoMxnNative ?? 0),
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

/**
 * Normaliza un embarque con datos de profit (USD legacy + MXN homologado).
 */
function parseEmbarqueConProfitRaw(r: Record<string, unknown>): EmbarqueConProfit {
  const ventaUSD = Number(r.ventaUSD ?? 0);
  const costoUSD = Number(r.costoUSD ?? 0);
  const profit = r.profit !== undefined && r.profit !== null ? Number(r.profit) : ventaUSD - costoUSD;
  const margen = r.margen !== undefined && r.margen !== null
    ? Number(r.margen)
    : ventaUSD > 0 ? (profit / ventaUSD) * 100 : 0;
  const ventaMXN = Number(r.ventaMXN ?? 0);
  const costoMXN = Number(r.costoMXN ?? 0);
  const profitMXN = r.profitMXN !== undefined && r.profitMXN !== null
    ? Number(r.profitMXN)
    : ventaMXN - costoMXN;
  const margenMXN = r.margenMXN !== undefined && r.margenMXN !== null
    ? Number(r.margenMXN)
    : ventaMXN > 0 ? (profitMXN / ventaMXN) * 100 : 0;
  return {
    ...(fromDb<EmbarqueConProfit>(r)),
    ventaUSD,
    costoUSD,
    profit,
    margen,
    ventaMXN,
    costoMXN,
    profitMXN,
    margenMXN,
    tipoCambioUSD: Number(r.tipoCambioUSD ?? 0),
    tipoCambioEUR: Number(r.tipoCambioEUR ?? 0),
    ventaMxnFromUsd: Number(r.ventaMxnFromUsd ?? 0),
    costoMxnFromUsd: Number(r.costoMxnFromUsd ?? 0),
    ventaMxnFromEur: Number(r.ventaMxnFromEur ?? 0),
    costoMxnFromEur: Number(r.costoMxnFromEur ?? 0),
    ventaMxnNative: Number(r.ventaMxnNative ?? 0),
    costoMxnNative: Number(r.costoMxnNative ?? 0),
  };
}

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
