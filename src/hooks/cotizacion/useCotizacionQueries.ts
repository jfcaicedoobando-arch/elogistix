import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { CotizacionRow } from './useCotizacionTypes';
import { useOrgFilter } from '@/hooks/useOrgFilter';
import {
  fetchCotizaciones,
  fetchCotizacionesAceptadas,
  fetchCotizacionById,
  fetchEmbarquesVinculados,
  fetchCotizacionesPaginadas,
} from '@/services/cotizacionServices';

export function useCotizacionesAceptadas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.cotizaciones.all, 'aceptadas', organizationId] as const,
    queryFn: () => fetchCotizacionesAceptadas(organizationId),
  });
}

export function useCotizaciones() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.cotizaciones.all, organizationId],
    queryFn: () => fetchCotizaciones(organizationId),
  });
}

interface UseCotizacionesPaginadasParams {
  search: string;
  filterEstado: string;
  filterCliente: string;
  page: number;
  pageSize: number;
}

export function useCotizacionesPaginadas(params: UseCotizacionesPaginadasParams) {
  const { organizationId } = useOrgFilter();
  const filters = { ...params, organizationId };
  return useQuery({
    queryKey: [...queryKeys.cotizaciones.all, 'paginadas', filters] as const,
    queryFn: () => fetchCotizacionesPaginadas({ ...params, organizationId }),
    placeholderData: (prev) => prev,
  });
}

export function useCotizacion(id: string | undefined) {
  return useQuery<CotizacionRow>({
    queryKey: queryKeys.cotizaciones.detail(id!),
    queryFn: () => fetchCotizacionById(id!),
    enabled: !!id,
  });
}

/** Hook para prefetch en hover (lista → detalle) */
export function usePrefetchCotizacion() {
  const queryClient = useQueryClient();
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.cotizaciones.detail(id),
      queryFn: () => fetchCotizacionById(id),
      staleTime: 30_000,
    });
  };
}

/** Embarques vinculados a una cotización */
export function useEmbarquesVinculados(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.embarquesVinculados(cotizacionId!),
    queryFn: () => fetchEmbarquesVinculados(cotizacionId!),
    enabled: !!cotizacionId,
  });
}
