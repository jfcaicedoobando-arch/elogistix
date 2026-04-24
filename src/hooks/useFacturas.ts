import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';
import { useOrgFilter } from '@/hooks/useOrgFilter';

export type FacturaRow = Tables<'facturas'>;

/** Columnas para lista de facturas (UI tabla + reportes) */
const FACTURA_LIST_COLUMNS = 'id, numero, cliente_nombre, expediente, total, moneda, fecha_emision, fecha_vencimiento, estado, proforma_id, factura_pdf_url, factura_xml_url, proformas:proforma_id(numero)' as const;

export function useFacturas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.facturas.all, organizationId],
    queryFn: async () => {
      let query = supabase
        .from('facturas')
        .select(FACTURA_LIST_COLUMNS)
        .order('created_at', { ascending: false });
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
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
      queryClient.invalidateQueries({ queryKey: queryKeys.facturas.gastosPendientes });
    },
  });
}

export function useGastosPendientes() {
  return useQuery({
    queryKey: queryKeys.facturas.gastosPendientes,
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
