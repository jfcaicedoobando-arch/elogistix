import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { useOrgFilter } from '@/hooks/shared/useOrgFilter';
import {
  fetchEmbarques,
  fetchEmbarquesPaginados,
  fetchEmbarqueById,
  fetchEmbarqueConceptosVenta,
  fetchEmbarqueConceptosCosto,
  fetchEmbarqueDocumentos,
  fetchEmbarqueNotas,
  fetchEmbarqueFacturas,
  fetchExpedientesCliente,
  fetchProveedoresForSelect,
} from '@/services/embarque';


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
  sortBy?: import('@/services/embarque/queries').SortableEmbarqueColumn;
  sortDir?: 'asc' | 'desc';
}

export function useEmbarquesPaginados({
  search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma = 'todos', page, pageSize, fechaDesde, fechaHasta, sortBy, sortDir,
}: UseEmbarquesPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters = { search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma, page, pageSize, fechaDesde, fechaHasta, sortBy, sortDir, organizationId };

  return useQuery({
    queryKey: queryKeys.embarques.list(filters),
    queryFn: () => fetchEmbarquesPaginados({
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
    }),
    placeholderData: (prev) => prev,
  });
}

export function useEmbarque(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.detail(id!),
    queryFn: () => fetchEmbarqueById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Hook para prefetch en hover (lista → detalle) */
export function usePrefetchEmbarque() {
  const queryClient = useQueryClient();
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.embarques.detail(id),
      queryFn: () => fetchEmbarqueById(id),
      staleTime: 30_000,
    });
  };
}

export function useEmbarqueConceptosVenta(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.conceptosVenta(embarqueId!),
    queryFn: () => fetchEmbarqueConceptosVenta(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}

export function useEmbarqueConceptosCosto(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.conceptosCosto(embarqueId!),
    queryFn: () => fetchEmbarqueConceptosCosto(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}


export type { ExpedienteCliente } from '@/services/embarque';

export function useExpedientesCliente(clienteId: string | undefined) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.embarques.all, 'expedientes-cliente', clienteId, organizationId],
    staleTime: 60_000,
    queryFn: () => (clienteId ? fetchExpedientesCliente(clienteId) : Promise.resolve([])),
    enabled: !!clienteId,
  });
}

export function useProveedoresForSelect() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.proveedores.select, organizationId],
    queryFn: () => fetchProveedoresForSelect(organizationId),
    staleTime: 5 * 60_000,
  });
}
