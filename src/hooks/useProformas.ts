import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Database } from '@/integrations/supabase/types';
import { useOrgFilter } from '@/hooks/useOrgFilter';

export type ProformaRow = Tables<'proformas'>;
export type EstadoProforma = Database['public']['Enums']['estado_proforma'];
export type MonedaProforma = Database['public']['Enums']['moneda'];

export interface ConceptoProforma {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  moneda: MonedaProforma;
  total: number;
}

export const proformasKeys = {
  all: ['proformas'] as const,
  byEmbarque: (embarqueId: string) => ['proformas', 'embarque', embarqueId] as const,
  list: (orgId: string | undefined) => ['proformas', 'list', orgId] as const,
};

/** Lista global de proformas (módulo Facturación) */
export function useProformas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: proformasKeys.list(organizationId),
    queryFn: async () => {
      let query = supabase
        .from('proformas')
        .select('id, numero, expediente, embarque_id, cliente_id, cliente_nombre, total, moneda, estado, factura_externa_folio, fecha_facturacion, created_at')
        .order('created_at', { ascending: false });
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/** Proformas de un embarque concreto */
export function useProformasEmbarque(embarqueId: string | undefined) {
  return useQuery({
    queryKey: proformasKeys.byEmbarque(embarqueId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proformas')
        .select('*')
        .eq('embarque_id', embarqueId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProformaRow[];
    },
    enabled: !!embarqueId,
  });
}

interface CrearProformaInput {
  embarque_id: string;
  expediente: string;
  cliente_id: string | null;
  cliente_nombre: string;
  conceptos: ConceptoProforma[];
  moneda: MonedaProforma;
  subtotal: number;
  iva: number;
  total: number;
  notas?: string;
}

export function useCrearProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearProformaInput) => {
      // Calcular consecutivo por embarque
      const { count, error: countError } = await supabase
        .from('proformas')
        .select('id', { count: 'exact', head: true })
        .eq('embarque_id', input.embarque_id);
      if (countError) throw countError;
      const seq = (count || 0) + 1;
      const numero = `PRO-${input.expediente}-${String(seq).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('proformas')
        .insert({
          embarque_id: input.embarque_id,
          expediente: input.expediente,
          cliente_id: input.cliente_id,
          cliente_nombre: input.cliente_nombre,
          numero,
          conceptos: input.conceptos as unknown as Database['public']['Tables']['proformas']['Insert']['conceptos'],
          subtotal: input.subtotal,
          iva: input.iva,
          total: input.total,
          moneda: input.moneda,
          notas: input.notas || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: proformasKeys.all });
      qc.invalidateQueries({ queryKey: proformasKeys.byEmbarque(data.embarque_id) });
      qc.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}

export function useMarcarProformaFacturada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, folio, fecha }: { id: string; folio: string; fecha: string }) => {
      const { error } = await supabase.rpc('marcar_proforma_facturada', {
        p_id: id,
        p_folio: folio,
        p_fecha: fecha,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proformasKeys.all });
    },
  });
}

export function useCancelarProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('proformas')
        .update({ estado: 'Cancelada' as EstadoProforma })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proformasKeys.all });
      qc.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}

export function useEliminarProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proformas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proformasKeys.all });
      qc.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}
