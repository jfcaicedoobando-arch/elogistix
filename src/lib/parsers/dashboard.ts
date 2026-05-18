/**
 * Pure parsers for the `dashboard_stats()` JSONB RPC payload.
 * Extracted from useDashboardData to keep the hook focused on query+state.
 */
import { ESTADOS_ACTIVOS } from "@/constants/embarqueConstants";
import { fromDb } from "@/lib/supabase/cast";

export interface EmbarqueConEstado {
  id: string;
  expediente: string;
  cliente_nombre: string;
  modo: string;
  tipo: string;
  estado: string;
  estadoReal: string;
  etd: string | null;
  eta: string | null;
  operador: string;
  puerto_origen?: string | null;
  puerto_destino?: string | null;
  aeropuerto_origen?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_origen?: string | null;
  ciudad_destino?: string | null;
  contenedor?: string | null;
  created_at: string;
}

export interface AlertaDemora extends EmbarqueConEstado {
  diasDemora: number;
  diasDesdeEta: number;
}

export interface ProximoArribo extends EmbarqueConEstado {
  diasRestantes: number;
}

export interface EmbarqueConProfit extends EmbarqueConEstado {
  ventaUSD: number;
  costoUSD: number;
  profit: number;
  margen: number;
  // MXN homologado (usando TC del embarque)
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  margenMXN: number;
  tipoCambioUSD: number;
  tipoCambioEUR: number;
  ventaMxnFromUsd: number;
  costoMxnFromUsd: number;
  ventaMxnFromEur: number;
  costoMxnFromEur: number;
  ventaMxnNative: number;
  costoMxnNative: number;
}

export interface EmbarqueMesSiguiente extends EmbarqueConProfit {
  facturado: boolean;
}

export interface ResumenFacturacion {
  totalEmbarques: number;
  ventaUSD: number;
  costoUSD: number;
  profitUSD: number;
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  facturados: number;
  nombreMes: string;
}

export interface CargaPorCliente {
  clienteId: string;
  clienteNombre: string;
  total: number;
  desglose: Record<EstadoFiltro, number>;
}

export interface ArribosEsteMes {
  total: number;
  yaLlegaron: number;
  enCamino: number;
  profitUSD: number;
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  ventaMxnFromUsd: number;
  costoMxnFromUsd: number;
  ventaMxnFromEur: number;
  costoMxnFromEur: number;
  ventaMxnNative: number;
  costoMxnNative: number;
}

export const ESTADOS_FILTRO = ESTADOS_ACTIVOS;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

export const EMPTY_CONTEO: Record<EstadoFiltro, number> = {
  Confirmado: 0,
  "En Tránsito": 0,
  Arribo: 0,
  "En Aduana": 0,
  Entregado: 0,
};

export const EMPTY_ARRIBOS: ArribosEsteMes = {
  total: 0,
  yaLlegaron: 0,
  enCamino: 0,
  profitUSD: 0,
  ventaMXN: 0,
  costoMXN: 0,
  profitMXN: 0,
  ventaMxnFromUsd: 0,
  costoMxnFromUsd: 0,
  ventaMxnFromEur: 0,
  costoMxnFromEur: 0,
  ventaMxnNative: 0,
  costoMxnNative: 0,
};

export const EMPTY_RESUMEN: ResumenFacturacion = {
  totalEmbarques: 0,
  ventaUSD: 0,
  costoUSD: 0,
  profitUSD: 0,
  ventaMXN: 0,
  costoMXN: 0,
  profitMXN: 0,
  facturados: 0,
  nombreMes: "",
};

type DashboardStats = Record<string, unknown> | null | undefined;

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
