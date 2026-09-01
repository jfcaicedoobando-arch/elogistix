import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CotizacionRow } from '@/features/cotizacion/types';
import { useOrgFilter } from '@/hooks/shared/useOrgFilter';
import { cotizacionQueries } from '@/features/cotizacion/queries';

export function useCotizacionesAceptadas() {
  const { organizationId } = useOrgFilter();
  return useQuery(cotizacionQueries.aceptadas(organizationId));
}

export function useCotizacion(id: string | undefined) {
  return useQuery<CotizacionRow | null>({
    ...cotizacionQueries.detail(id ?? ''),
    enabled: !!id,
  });
}

/** Hook para prefetch en hover (lista → detalle) */
export function usePrefetchCotizacion() {
  const queryClient = useQueryClient();
  return (id: string) => {
    queryClient.prefetchQuery(cotizacionQueries.detail(id));
  };
}

/** Embarques vinculados a una cotización */
export function useEmbarquesVinculados(cotizacionId: string | undefined) {
  return useQuery({
    ...cotizacionQueries.embarquesVinculados(cotizacionId ?? ''),
    enabled: !!cotizacionId,
  });
}

/** Folio de una cotización (consulta liviana para chips/links). */
export function useCotizacionFolio(cotizacionId: string | null | undefined) {
  return useQuery<string | null>({
    ...cotizacionQueries.folio(cotizacionId ?? ''),
    enabled: !!cotizacionId,
  });
}
