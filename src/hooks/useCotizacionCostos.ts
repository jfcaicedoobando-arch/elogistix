import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';


export interface CostoCotizacion {
  id: string;
  cotizacion_id: string;
  concepto: string;
  moneda: 'USD' | 'MXN';
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  created_at: string;
  updated_at: string;
}

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

export function useUpsertCotizacionCostos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cotizacionId, costos }: { cotizacionId: string; costos: CostoCotizacion[] }) => {
      // DELETE all existing
      const { error: delError } = await supabase
        .from('cotizacion_costos')
        .delete()
        .eq('cotizacion_id', cotizacionId);
      if (delError) throw delError;

      if (costos.length === 0) return [];

      // INSERT new (omit costo_total — it's a generated column)
      const rows = costos.map((c) => ({
        cotizacion_id: cotizacionId,
        concepto: c.concepto,
        moneda: c.moneda,
        proveedor: c.proveedor,
        cantidad: c.cantidad,
        costo_unitario: c.costo_unitario,
      }));

      const { data, error } = await supabase
        .from('cotizacion_costos')
        .insert(rows as any)
        .select();
      if (error) throw error;
      return (data ?? []) as unknown as CostoCotizacion[];
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotizacion_costos', variables.cotizacionId] });
    },
  });
}
