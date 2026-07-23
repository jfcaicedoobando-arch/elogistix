import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
} from '@/features/cotizacion/services';
import { newRequestId } from '@/lib/idempotency';
import { notifyError } from '@/lib/ui/appFeedback';

export type { CostoCotizacion } from '@/features/cotizacion/types';
import type { CostoCotizacion } from '@/features/cotizacion/types';

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
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al guardar costos: ${error.message}`, error, method: "UPSERT_COTIZACION_COSTOS" });
    },
  });
}

