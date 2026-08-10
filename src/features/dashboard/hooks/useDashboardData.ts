import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrgActiva } from "@/hooks/shared";
import { fetchDashboardSummary, fetchDashboardDetails } from "@/features/dashboard/services";
import {
  ESTADOS_FILTRO,
  parseConteoPorEstado,
  parseArribosEsteMes,
  parseResumenMesSiguiente,
  parseEmbarquesMesSiguiente,
  parseProfitArribosEsteMes,
  parseCargasPorCliente,
  parseCargasActivasTotal,
  parseEmbarquesEir,
  combinarActivos,
  type AlertaDemora,
  type ProximoArribo,
  type EmbarqueConProfit,
  type EmbarqueEirLite,
  type EmbarqueMesSiguiente,
} from "@/features/dashboard/domain/parsers/dashboard";

// Re-exports para preservar la API pública de este hook
export { ESTADOS_FILTRO };
export type {
  EstadoFiltro,
  
  AlertaDemora,
  ProximoArribo,
  EmbarqueConProfit,
  EmbarqueMesSiguiente,
  ResumenFacturacion,
} from "@/features/dashboard/domain/parsers/dashboard";

/**
 * Dashboard data powered by a single server-side RPC `dashboard_stats()`.
 * El parsing de la respuesta JSONB se delega a `lib/dashboardParsers` (puro y testeable).
 * Este hook se concentra en orquestar la query, el filtro de estado y los memos.
 */
export function useDashboardData() {
  const { organizationId } = useOrgActiva();
  // Summary: KPIs + conteos + resumen mensual — payload pequeño, carga eager
  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard.statsSummary(organizationId),
    queryFn: fetchDashboardSummary,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Details: listas largas — corre EN PARALELO con summary (no esperamos a que summary
  // termine). HTTP/2 multiplexa ambas peticiones sobre la misma conexión, mejorando TTI.
  const { data: details } = useQuery({
    queryKey: queryKeys.dashboard.statsDetails(organizationId),
    queryFn: fetchDashboardDetails,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Combinamos ambos payloads en un solo objeto para mantener el contrato del hook intacto
  const stats = useMemo(
    () => ({ ...(summary ?? {}), ...(details ?? {}) }) as Record<string, unknown>,
    [summary, details],
  );

  const conteoPorEstado = useMemo(() => parseConteoPorEstado(stats), [stats]);
  const totalActivos = Number(stats?.totalActivos ?? 0);

  // v13.301.64 · Auditoría 698×572: dedupe defensivo por `id` para evitar
  // warnings de React "duplicate key" cuando el RPC devuelve el mismo
  // embarque en más de una fila (alertas y arribos vienen de joins).
  const dedupeById = <T extends { id: string }>(rows: T[] | null | undefined): T[] =>
    Array.from(new Map((rows ?? []).map((r) => [r.id, r])).values());

  const alertasDemora = useMemo<AlertaDemora[]>(
    () => dedupeById((stats?.alertasDemora as AlertaDemora[]) ?? []),
    [stats],
  );

  const proximosArribos = useMemo<ProximoArribo[]>(
    () => dedupeById((stats?.proximosArribos as ProximoArribo[]) ?? []),
    [stats],
  );

  const profitArribosEsteMes = useMemo<EmbarqueConProfit[]>(
    () => dedupeById(parseProfitArribosEsteMes(stats)),
    [stats],
  );

  const arribosEsteMes = useMemo(() => parseArribosEsteMes(stats), [stats]);

  const embarquesMesSiguiente = useMemo<EmbarqueMesSiguiente[]>(
    () => dedupeById(parseEmbarquesMesSiguiente(stats)),
    [stats],
  );

  const cargasPorCliente = useMemo(() => {
    // v13.301.64 · dedupe por `clienteId` — el RPC puede regresar un cliente
    // en más de una fila (impersonación / branch legacy) y el `key` del
    // grid en `CargasActivasClienteCard` es `c.clienteId`.
    const rows = parseCargasPorCliente(stats);
    return Array.from(new Map(rows.map((r) => [r.clienteId, r])).values());
  }, [stats]);
  const cargasActivasTotal = useMemo(() => parseCargasActivasTotal(stats), [stats]);

  // v13.303.13 · Listado ligero de EIR para el scope "mios" (chip EIR).
  const embarquesEir = useMemo<EmbarqueEirLite[]>(
    () => parseEmbarquesEir(stats),
    [stats],
  );

  const resumenMesSiguiente = useMemo(() => parseResumenMesSiguiente(stats), [stats]);

  const activos = useMemo(
    () => combinarActivos(alertasDemora, proximosArribos, profitArribosEsteMes, embarquesMesSiguiente),
    [alertasDemora, proximosArribos, profitArribosEsteMes, embarquesMesSiguiente],
  );

  return {
    isLoading,
    isError,
    refetch,
    activos,
    conteoPorEstado,
    totalActivos,
    alertasDemora,
    proximosArribos,
    profitArribosEsteMes,
    embarquesMesSiguiente,
    embarquesEir,
    resumenMesSiguiente,
    arribosEsteMes,
    cargasPorCliente,
    cargasActivasTotal,
  };
}
