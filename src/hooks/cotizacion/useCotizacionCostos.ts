import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
} from '@/services/cotizacion';

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
    mutationFn: ({ cotizacionId, costos }: { cotizacionId: string; costos: CostoCotizacion[] }) =>
      upsertCotizacionCostos(cotizacionId, costos),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.costos(variables.cotizacionId) });
    },
  });
}
