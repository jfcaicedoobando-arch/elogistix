import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchDashboardSummary, fetchDashboardDetails } from "@/services/dashboard";
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
} from "@/lib/parsers/dashboard";

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
} from "@/lib/parsers/dashboard";

/**
 * Dashboard data powered by a single server-side RPC `dashboard_stats()`.
 * El parsing de la respuesta JSONB se delega a `lib/dashboardParsers` (puro y testeable).
 * Este hook se concentra en orquestar la query, el filtro de estado y los memos.
 */
export function useDashboardData() {
  // Summary: KPIs + conteos + resumen mensual — payload pequeño, carga eager
  const { data: summary, isLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.stats, "summary"],
    queryFn: fetchDashboardSummary,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Details: listas largas — solo después de que summary terminó (no bloquea TTI)
  const { data: details } = useQuery({
    queryKey: [...queryKeys.dashboard.stats, "details"],
    queryFn: fetchDashboardDetails,
    enabled: !!summary,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Combinamos ambos payloads en un solo objeto para mantener el contrato del hook intacto
  const stats = useMemo(
    () => ({ ...(summary ?? {}), ...(details ?? {}) }) as Record<string, unknown>,
    [summary, details],
  );

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
    () => parseEmbarquesMesSiguiente(stats),
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
