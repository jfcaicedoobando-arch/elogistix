import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchCotizacionCostos,
  fetchCotizacionCostosSnapshot,
  upsertCotizacionCostos,
} from '@/features/cotizacion/services';
import { newRequestId } from '@/lib/idempotency';

export type { CostoCotizacion } from '@/features/cotizacion/types';
import type { CostoCotizacion } from '@/features/cotizacion/types';

export function useCotizacionCostos(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.costos(cotizacionId ?? ''),
    queryFn: () => cotizacionId ? fetchCotizacionCostos(cotizacionId) : Promise.resolve([]),
    enabled: !!cotizacionId,
  });
}

export function useCotizacionCostosSnapshot(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.costosSnapshot(cotizacionId ?? ''),
    queryFn: () => fetchCotizacionCostosSnapshot(cotizacionId ?? ''),
    enabled: !!cotizacionId,
  });
}

export function useUpsertCotizacionCostos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, costos, requestId, expectedUpdatedAt }: {
      cotizacionId: string;
      costos: CostoCotizacion[];
      requestId?: string;
      /** v13.823.69: sello de la cotización; la RPC rechaza el reemplazo si cambió. */
      expectedUpdatedAt?: string | null;
    }) =>
      upsertCotizacionCostos(cotizacionId, costos, requestId ?? newRequestId(), expectedUpdatedAt),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.cotizaciones.costosSnapshot(variables.cotizacionId),
        data,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.costos(variables.cotizacionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.costosSnapshot(variables.cotizacionId) });
      // v13.823.164: el reemplazo mueve `cotizaciones.updated_at`; el detalle
      // debe releerse para que el siguiente sello venga fresco de la BD.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(variables.cotizacionId) });
    },
    // v13.823.164: sin `onError` aquí. El call site ya muestra un único aviso
    // ("Error al guardar" con detalle); antes salían DOS toasts por el mismo
    // fallo (este + el catch del componente).
  });
}

