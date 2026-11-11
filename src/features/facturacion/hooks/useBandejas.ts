/**
 * Hooks para las bandejas de trabajo del cockpit de Facturación (Fase 2).
 *
 * Cada hook envuelve una query de `services/bandejas.ts` con react-query
 * y una staleTime de 60 s. El hook de conteos alimenta los badges en la
 * fila de tabs.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  fetchFacturasPorTimbrar,
  fetchPagosRepPendientes,
  REP_PENDIENTES_SORT_KEYS,
  type RepPendientesFilters,
  fetchRepsHistorico,
  fetchBandejaConteos,
  type FilaPorTimbrar,
  type FilaRepPendiente,
  type FilaRepHistorico,
} from "@/features/facturacion/services/bandejas";

export type { FilaPorTimbrar, FilaRepPendiente, FilaRepHistorico };

const STALE = 60_000;
const REP_PENDIENTES_DEFAULTS: RepPendientesFilters = { estado: "todos" };

export function useFacturasPorTimbrar() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaPorTimbrar(organizationId),
    queryFn: () => fetchFacturasPorTimbrar(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}


export function usePagosRepPendientes(organizationId: string | null) {
  const list = useServerPagedList<FilaRepPendiente, RepPendientesFilters>({
    queryKey: queryKeys.facturacion.bandejaRepPendientes(organizationId),
    fetcher: (args) => fetchPagosRepPendientes(organizationId!, args),
    defaultFilters: REP_PENDIENTES_DEFAULTS,
    filterLabels: { estado: "Estado REP" },
    defaultSort: { key: "fecha_pago", dir: "desc" },
    sortableKeys: REP_PENDIENTES_SORT_KEYS,
    enabled: Boolean(organizationId),
    staleTime: STALE,
  });
  const { error, isFetching, isStaleView, page, totalPages, setPage } = list;
  useEffect(() => {
    if (!organizationId || !page || isFetching || isStaleView) return;
    // La última página puede desaparecer después de timbrar sus REP.
    if (error && "code" in error && error.code === "PGRST103") setPage(0);
    else if (!error && page >= totalPages) setPage(totalPages - 1);
  }, [organizationId, error, isFetching, isStaleView, page, totalPages, setPage]);
  return list;
}

export function useRepsHistorico() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaRepsHistorico(organizationId),
    queryFn: () => fetchRepsHistorico(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function useBandejaConteos() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaConteos(organizationId),
    queryFn: () => fetchBandejaConteos(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}
