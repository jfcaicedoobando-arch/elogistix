import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrgFilter } from '@/hooks/shared/useOrgFilter';
import { embarqueQueries } from '@/features/embarques/queries';
import type { EmbarquesPaginadosFilters } from '@/features/embarques/services';


interface UseEmbarquesPaginadosParams {
  search: string;
  filterModo: string;
  filterEstado: string;
  filterCliente: string;
  filterOperador: string;
  filterProforma?: string;
  page: number;
  pageSize: number;
  fechaDesde?: string;
  fechaHasta?: string;
  sortBy?: import('@/features/embarques/services/queries').SortableEmbarqueColumn;
  sortDir?: 'asc' | 'desc';
}

export function useEmbarquesPaginados({
  search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma = 'todos', page, pageSize, fechaDesde, fechaHasta, sortBy, sortDir,
}: UseEmbarquesPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters: EmbarquesPaginadosFilters & { filterEstado: string } = {
    organizationId,
    search,
    filterModo,
    filterCliente,
    filterOperador,
    filterProforma,
    fechaDesde,
    fechaHasta,
    page,
    pageSize,
    sortBy,
    sortDir,
    filterEstado,
  };

  return useQuery({
    ...embarqueQueries.list(filters),
    placeholderData: (prev) => prev,
  });
}

export function useEmbarque(id: string | undefined) {
  return useQuery({
    ...embarqueQueries.detail(id ?? ''),
    enabled: !!id,
  });
}

/** Hook para prefetch en hover (lista → detalle) */
export function usePrefetchEmbarque() {
  const queryClient = useQueryClient();
  return (id: string) => {
    queryClient.prefetchQuery(embarqueQueries.detail(id));
  };
}

export function useEmbarqueConceptosVenta(embarqueId: string | undefined) {
  return useQuery({
    ...embarqueQueries.conceptosVenta(embarqueId ?? ''),
    enabled: !!embarqueId,
  });
}

export function useEmbarqueConceptosCosto(embarqueId: string | undefined) {
  return useQuery({
    ...embarqueQueries.conceptosCosto(embarqueId ?? ''),
    enabled: !!embarqueId,
  });
}


export type { ExpedienteCliente } from '@/features/embarques/services';

export function useExpedientesCliente(clienteId: string | undefined) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    ...embarqueQueries.expedientesCliente(clienteId ?? '', organizationId),
    enabled: !!clienteId,
  });
}

/** Proveedores presentes en los costos del embarque (buzón CxP). */
export function useProveedoresDelEmbarque(embarqueId: string | undefined) {
  return useQuery({
    ...embarqueQueries.proveedoresDelEmbarque(embarqueId ?? ''),
    enabled: !!embarqueId,
  });
}

export function useProveedoresForSelect() {
  const { organizationId } = useOrgFilter();
  return useQuery(embarqueQueries.proveedoresSelect(organizationId));
}
