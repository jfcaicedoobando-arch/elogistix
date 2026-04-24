import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useOrgFilter } from '@/hooks/useOrgFilter';
import { toast } from 'sonner';

export type ProformaRow = Tables<'proformas'>;

/** Lista las proformas de un embarque */
export function useProformasEmbarque(embarqueId?: string) {
  return useQuery({
    queryKey: ['proformas', 'embarque', embarqueId],
    enabled: !!embarqueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proformas')
        .select('*')
        .eq('embarque_id', embarqueId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProformaRow[];
    },
    staleTime: 30_000,
  });
}

/** Lista todas las proformas de la organización */
export function useProformas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ['proformas', 'all', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proformas')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProformaRow[];
    },
    staleTime: 30_000,
  });
}

interface CrearProformaParams {
  embarqueId: string;
  clienteId: string;
  clienteNombre: string;
  expediente: string;
  blMaster?: string | null;
  conceptoIds: string[];
  totales: {
    subtotal_usd: number;
    iva_usd: number;
    total_usd: number;
    subtotal_mxn: number;
    iva_mxn: number;
    total_mxn: number;
  };
  notas?: string;
}

/** Crea una proforma y marca conceptos como en_proforma */
export function useCrearProforma() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgFilter();

  return useMutation({
    mutationFn: async (params: CrearProformaParams) => {
      if (!organizationId) throw new Error('Organización no disponible');
      if (params.conceptoIds.length === 0) throw new Error('Debe seleccionar al menos un concepto');

      // 1. Generar número consecutivo
      const { data: numero, error: errNum } = await supabase
        .rpc('generar_numero_proforma', { p_org_id: organizationId });
      if (errNum) throw errNum;

      // 2. Insertar proforma
      const { data: proforma, error: errProf } = await supabase
        .from('proformas')
        .insert({
          numero: numero as string,
          embarque_id: params.embarqueId,
          cliente_id: params.clienteId,
          cliente_nombre: params.clienteNombre,
          expediente: params.expediente,
          bl_master: params.blMaster ?? null,
          subtotal_usd: params.totales.subtotal_usd,
          iva_usd: params.totales.iva_usd,
          total_usd: params.totales.total_usd,
          subtotal_mxn: params.totales.subtotal_mxn,
          iva_mxn: params.totales.iva_mxn,
          total_mxn: params.totales.total_mxn,
          notas: params.notas ?? null,
          organization_id: organizationId,
        })
        .select()
        .single();
      if (errProf) throw errProf;

      // 3. Marcar conceptos como en_proforma
      const { error: errUpd } = await supabase
        .from('conceptos_venta')
        .update({
          estado_facturacion: 'en_proforma',
          proforma_id: proforma.id,
        })
        .in('id', params.conceptoIds);
      if (errUpd) {
        // Rollback: eliminar proforma creada
        await supabase.from('proformas').delete().eq('id', proforma.id);
        throw errUpd;
      }

      return proforma as ProformaRow;
    },
    onSuccess: (proforma) => {
      toast.success(`Proforma ${proforma.numero} generada`);
      queryClient.invalidateQueries({ queryKey: ['proformas', 'embarque', proforma.embarque_id] });
      queryClient.invalidateQueries({ queryKey: ['embarque', proforma.embarque_id] });
      queryClient.invalidateQueries({ queryKey: ['conceptos_venta'] });
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al generar proforma: ${error.message}`);
    },
  });
}
