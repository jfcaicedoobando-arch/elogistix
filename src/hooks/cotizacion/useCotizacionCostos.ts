import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
} from '@/services/cotizacion';
import { newRequestId } from '@/lib/idempotency';

export type { CostoCotizacion } from '@/types/cotizacionCosto';
import type { CostoCotizacion } from '@/types/cotizacionCosto';

export function useCotizacionCostos(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.costos(cotizacionId!),
    queryFn: () => fetchCotizacionCostos(cotizacionId!),
    enabled: !!cotizacionId,
  });
}

export function useUpsertCotizacionCostos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, costos, requestId }: { cotizacionId: string; costos: CostoCotizacion[]; requestId?: string }) =>
      upsertCotizacionCostos(cotizacionId, costos, requestId ?? newRequestId()),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.costos(variables.cotizacionId) });
    },
  });
}

