import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type FacturaRow = Tables<'facturas'>;

/** Columnas para lista de facturas y reportes */
const FACTURA_LIST_COLUMNS = 'id, numero, cliente_id, cliente_nombre, embarque_id, expediente, estado, moneda, subtotal, iva, total, tipo_cambio, fecha_emision, fecha_vencimiento, referencia_bl, notas, created_at, updated_at' as const;

export function useFacturas() {
  return useQuery({
    queryKey: ['facturas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select(FACTURA_LIST_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FacturaRow[];
    },
  });
}

export function useMarcarCostoPagado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, referenciaPago }: { id: string; referenciaPago?: string }) => {
      const { error } = await supabase
        .from('conceptos_costo')
        .update({
          estado_liquidacion: 'Pagado',
          fecha_pago: new Date().toISOString().split('T')[0],
          referencia_pago: referenciaPago || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptos_costo'] });
      queryClient.invalidateQueries({ queryKey: ['gastos_pendientes'] });
    },
  });
}

export function useGastosPendientes() {
  return useQuery({
    queryKey: ['gastos_pendientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_costo')
        .select('*, embarques!conceptos_costo_embarque_id_fkey(expediente)')
        .eq('estado_liquidacion', 'Pendiente')
        .order('fecha_vencimiento', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
