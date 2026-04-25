import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
} from '@/services/cotizacionServices';

export interface CostoCotizacion {
  id: string;
  cotizacion_id: string;
  concepto: string;
  moneda: 'USD' | 'MXN';
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  precio_venta?: number;
  unidad_medida?: string;
  notas?: string;
  created_at: string;
  updated_at: string;
}

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
