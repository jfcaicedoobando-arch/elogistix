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
  operador?: string | null;
  diasCredito?: number | null;
  /** Mapa conceptoId → aplica_iva decidido por el usuario (solo USD; MXN siempre true) */
  ivaOverrides?: Record<string, boolean>;
}

/** Crea una proforma y marca conceptos como en_proforma */
export function useCrearProforma() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgFilter();

  return useMutation({
    mutationFn: async (params: CrearProformaParams) => {
      if (!organizationId) throw new Error('Organización no disponible');
      if (params.conceptoIds.length === 0) throw new Error('Debe seleccionar al menos un concepto');

      // 0. Aplicar overrides de IVA en los conceptos seleccionados (uno por uno para respetar el valor)
      if (params.ivaOverrides) {
        const updates = Object.entries(params.ivaOverrides).map(([id, aplica]) =>
          supabase.from('conceptos_venta').update({ aplica_iva: aplica }).eq('id', id)
        );
        const results = await Promise.all(updates);
        const firstErr = results.find(r => r.error);
        if (firstErr?.error) throw firstErr.error;
      }

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
          operador: params.operador ?? null,
          dias_credito: params.diasCredito ?? null,
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

interface MarcarFacturadaParams {
  proformaId: string;
  embarqueId: string;
  folioFacturaExterna: string;
  fechaFacturacion: string; // YYYY-MM-DD
}

/** Marca una proforma como facturada con su folio externo */
export function useMarcarProformaFacturada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: MarcarFacturadaParams) => {
      const { error } = await supabase
        .from('proformas')
        .update({
          estado_proforma: 'facturada',
          folio_factura_externa: params.folioFacturaExterna,
          fecha_facturacion: params.fechaFacturacion,
        })
        .eq('id', params.proformaId);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      toast.success('Proforma marcada como facturada');
      queryClient.invalidateQueries({ queryKey: ['proformas', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['proformas', 'embarque', params.embarqueId] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
}

interface EliminarProformaParams {
  proformaId: string;
  embarqueId: string;
  numero: string;
}

/** Elimina una proforma, libera sus conceptos y actualiza tiene_proforma del embarque */
export function useEliminarProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EliminarProformaParams) => {
      // 1. Liberar conceptos: pendiente y quitar proforma_id
      const { error: errUpd } = await supabase
        .from('conceptos_venta')
        .update({ estado_facturacion: 'pendiente', proforma_id: null })
        .eq('proforma_id', params.proformaId);
      if (errUpd) throw errUpd;

      // 2. Eliminar la proforma
      const { error: errDel } = await supabase
        .from('proformas')
        .delete()
        .eq('id', params.proformaId);
      if (errDel) throw errDel;

      // 3. Verificar si quedan otras proformas; si no, marcar tiene_proforma = false
      const { count, error: errCount } = await supabase
        .from('proformas')
        .select('id', { count: 'exact', head: true })
        .eq('embarque_id', params.embarqueId);
      if (errCount) throw errCount;

      if ((count ?? 0) === 0) {
        const { error: errEmb } = await supabase
          .from('embarques')
          .update({ tiene_proforma: false })
          .eq('id', params.embarqueId);
        if (errEmb) throw errEmb;
      }

      return params;
    },
    onSuccess: (params) => {
      toast.success('Proforma eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['proformas', 'embarque', params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ['proformas', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['embarque', params.embarqueId] });
      queryClient.invalidateQueries({ queryKey: ['conceptos_venta'] });
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar proforma: ${error.message}`);
    },
  });
}
