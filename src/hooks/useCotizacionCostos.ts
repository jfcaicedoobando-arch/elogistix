import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostoCotizacion {
  id: string;
  cotizacion_id: string;
  concepto: string;
  moneda: string;
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
}

type CostoUpsert = Omit<CostoCotizacion, 'costo_total'>;

export function useCotizacionCostos(cotizacionId: string | undefined) {
  return useQuery({
    queryKey: ['cotizacion_costos', cotizacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizacion_costos')
        .select('*')
        .eq('cotizacion_id', cotizacionId!);
      if (error) throw error;
      return (data ?? []) as unknown as CostoCotizacion[];
    },
    enabled: !!cotizacionId,
  });
}

export function useUpsertCostos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (costos: CostoUpsert[]) => {
      const { data, error } = await supabase
        .from('cotizacion_costos')
        .upsert(costos as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      const cotizacionId = variables[0]?.cotizacion_id;
      if (cotizacionId) {
        qc.invalidateQueries({ queryKey: ['cotizacion_costos', cotizacionId] });
      }
    },
  });
}

export function useDeleteCosto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cotizacionId }: { id: string; cotizacionId: string }) => {
      const { error } = await supabase
        .from('cotizacion_costos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id, cotizacionId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['cotizacion_costos', result.cotizacionId] });
    },
  });
}

export function calcularTotalCostos(costos: CostoCotizacion[]): { totalUSD: number; totalMXN: number } {
  let totalUSD = 0;
  let totalMXN = 0;
  for (const c of costos) {
    const total = c.cantidad * c.costo_unitario;
    if (c.moneda === 'USD') totalUSD += total;
    else totalMXN += total;
  }
  return { totalUSD, totalMXN };
}
