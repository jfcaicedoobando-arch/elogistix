import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { CotizacionRow } from '@/features/cotizacion/types';
import { useOrgFilter } from '@/hooks/shared/useOrgFilter';
import {
  fetchCotizaciones,
  fetchCotizacionesAceptadas,
  fetchCotizacionById,
  fetchEmbarquesVinculados,
} from '@/features/cotizacion/services';

export function useCotizacionesAceptadas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.cotizaciones.aceptadas(organizationId),
    queryFn: () => fetchCotizacionesAceptadas(organizationId),
  });
}

export function useCotizaciones() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.cotizaciones.byOrg(organizationId),
    queryFn: () => fetchCotizaciones(organizationId),
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
