import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  ESTADOS_FILTRO,
  parseConteoPorEstado,
  parseArribosEsteMes,
  parseResumenMesSiguiente,
  parseCargasPorCliente,
  combinarActivos,
  type EstadoFiltro,
  type AlertaDemora,
  type ProximoArribo,
  type EmbarqueConProfit,
  type EmbarqueMesSiguiente,
} from "@/lib/dashboardParsers";

// Re-exports para preservar la API pública de este hook
export { ESTADOS_FILTRO };
export type {
  EstadoFiltro,
  EmbarqueConEstado,
  AlertaDemora,
  ProximoArribo,
  EmbarqueConProfit,
  EmbarqueMesSiguiente,
  ResumenFacturacion,
} from "@/lib/dashboardParsers";

/**
 * Dashboard data powered by a single server-side RPC `dashboard_stats()`.
 * El parsing de la respuesta JSONB se delega a `lib/dashboardParsers` (puro y testeable).
 * Este hook se concentra en orquestar la query, el filtro de estado y los memos.
 */
export function useDashboardData() {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_stats");
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    staleTime: 5 * 60_000, // 5 min — el dashboard no necesita refetch agresivo
    gcTime: 10 * 60_000,
  });

  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro | null>(null);

  const conteoPorEstado = useMemo(() => parseConteoPorEstado(stats), [stats]);
  const totalActivos = Number(stats?.totalActivos ?? 0);

  const alertasDemora = useMemo<AlertaDemora[]>(
    () => (stats?.alertasDemora as AlertaDemora[]) ?? [],
    [stats],
  );

  const proximosArribos = useMemo<ProximoArribo[]>(
    () => (stats?.proximosArribos as ProximoArribo[]) ?? [],
    [stats],
  );

  const profitArribosEsteMes = useMemo<EmbarqueConProfit[]>(
    () => (stats?.profitArribosEsteMes as EmbarqueConProfit[]) ?? [],
    [stats],
  );

  const arribosEsteMes = useMemo(() => parseArribosEsteMes(stats), [stats]);

  const embarquesMesSiguiente = useMemo<EmbarqueMesSiguiente[]>(
    () => (stats?.embarquesMesSiguiente as EmbarqueMesSiguiente[]) ?? [],
    [stats],
  );

  const cargasPorCliente = useMemo(() => parseCargasPorCliente(stats), [stats]);

  const resumenMesSiguiente = useMemo(() => parseResumenMesSiguiente(stats), [stats]);

  const activos = useMemo(
    () => combinarActivos(alertasDemora, proximosArribos, profitArribosEsteMes, embarquesMesSiguiente),
    [alertasDemora, proximosArribos, profitArribosEsteMes, embarquesMesSiguiente],
  );

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
