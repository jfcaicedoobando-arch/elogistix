import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { ESTADOS_ACTIVOS } from "@/data/embarqueConstants";

// ─── Types ───────────────────────────────────────────────
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
}

export interface EmbarqueMesSiguiente extends EmbarqueConProfit {
  facturado: boolean;
}

export interface ResumenFacturacion {
  totalEmbarques: number;
  ventaUSD: number;
  costoUSD: number;
  profitUSD: number;
  facturados: number;
  nombreMes: string;
}

export const ESTADOS_FILTRO = ESTADOS_ACTIVOS;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

const EMPTY_CONTEO: Record<EstadoFiltro, number> = {
  Confirmado: 0,
  "En Tránsito": 0,
  Arribo: 0,
  "En Aduana": 0,
  Entregado: 0,
};

const EMPTY_ARRIBOS = { total: 0, yaLlegaron: 0, enCamino: 0, profitUSD: 0 };

const EMPTY_RESUMEN: ResumenFacturacion = {
  totalEmbarques: 0,
  ventaUSD: 0,
  costoUSD: 0,
  profitUSD: 0,
  facturados: 0,
  nombreMes: "",
};

/**
 * Dashboard data powered by a single server-side RPC `dashboard_stats()`.
 * Replaces the previous approach of downloading ALL embarques + profit + facturas client-side.
 */
export function useDashboardData() {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_stats");
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });

  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro | null>(null);

  // Parse the JSONB response into typed objects
  const conteoPorEstado = useMemo<Record<EstadoFiltro, number>>(() => {
    if (!stats?.conteoPorEstado) return EMPTY_CONTEO;
    const raw = stats.conteoPorEstado as Record<string, number>;
    return {
      Confirmado: Number(raw["Confirmado"] ?? 0),
      "En Tránsito": Number(raw["En Tránsito"] ?? 0),
      Arribo: Number(raw["Arribo"] ?? 0),
      "En Aduana": Number(raw["En Aduana"] ?? 0),
      Entregado: Number(raw["Entregado"] ?? 0),
    };
  }, [stats]);

  const totalActivos = Number(stats?.totalActivos ?? 0);

  const alertasDemora = useMemo<AlertaDemora[]>(
    () => (stats?.alertasDemora as AlertaDemora[]) ?? [],
    [stats]
  );

  const proximosArribos = useMemo<ProximoArribo[]>(
    () => (stats?.proximosArribos as ProximoArribo[]) ?? [],
    [stats]
  );

  const profitArribosEsteMes = useMemo<EmbarqueConProfit[]>(
    () => (stats?.profitArribosEsteMes as EmbarqueConProfit[]) ?? [],
    [stats]
  );

  const arribosEsteMes = useMemo(() => {
    if (!stats?.arribosEsteMes) return EMPTY_ARRIBOS;
    const raw = stats.arribosEsteMes as Record<string, number>;
    return {
      total: Number(raw.total ?? 0),
      yaLlegaron: Number(raw.yaLlegaron ?? 0),
      enCamino: Number(raw.enCamino ?? 0),
      profitUSD: Number(raw.profitUSD ?? 0),
    };
  }, [stats]);

  const embarquesMesSiguiente = useMemo<EmbarqueMesSiguiente[]>(
    () => (stats?.embarquesMesSiguiente as EmbarqueMesSiguiente[]) ?? [],
    [stats]
  );

  const cargasPorCliente = useMemo(() => {
    if (!stats?.cargasPorCliente) return [];
    return stats.cargasPorCliente as Array<{
      clienteId: string;
      clienteNombre: string;
      total: number;
      desglose: Record<EstadoFiltro, number>;
    }>;
  }, [stats]);

  const resumenMesSiguiente = useMemo<ResumenFacturacion>(() => {
    if (!stats?.resumenMesSiguiente) return EMPTY_RESUMEN;
    const raw = stats.resumenMesSiguiente as Record<string, unknown>;
    return {
      totalEmbarques: Number(raw.totalEmbarques ?? 0),
      ventaUSD: Number(raw.ventaUSD ?? 0),
      costoUSD: Number(raw.costoUSD ?? 0),
      profitUSD: Number(raw.profitUSD ?? 0),
      facturados: Number(raw.facturados ?? 0),
      nombreMes: String(raw.nombreMes ?? ""),
    };
  }, [stats]);

  // Client-side filtering for the status card click interaction
  const activos = useMemo<EmbarqueConEstado[]>(() => {
    // We don't have the full activos list from the RPC (only filtered subsets).
    // For the status card filter, we combine available lists.
    // This is lightweight since each list is already small.
    const all = [
      ...alertasDemora,
      ...proximosArribos,
      ...profitArribosEsteMes,
      ...embarquesMesSiguiente,
    ];
    // Deduplicate by id
    const seen = new Set<string>();
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [alertasDemora, proximosArribos, profitArribosEsteMes, embarquesMesSiguiente]);

  return {
    isLoading,
    filtroEstado,
    setFiltroEstado,
    activos,
    conteoPorEstado,
    totalActivos,
    alertasDemora,
    proximosArribos,
    profitArribosEsteMes,
    embarquesMesSiguiente,
    resumenMesSiguiente,
    arribosEsteMes,
    cargasPorCliente,
  };
}
