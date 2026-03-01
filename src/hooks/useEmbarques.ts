import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type EmbarqueRow = Tables<'embarques'>;
export type ConceptoVentaRow = Tables<'conceptos_venta'>;
export type ConceptoCostoRow = Tables<'conceptos_costo'>;
export type DocumentoEmbarqueRow = Tables<'documentos_embarque'>;
export type NotaEmbarqueRow = Tables<'notas_embarque'>;

export function useEmbarques() {
  return useQuery({
    queryKey: ['embarques'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embarques')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmbarqueRow[];
    },
  });
}

export function useEmbarque(id: string | undefined) {
  return useQuery({
    queryKey: ['embarques', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const { data, error } = await supabase
        .from('embarques')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as EmbarqueRow;
    },
    enabled: !!id,
  });
}

export function useEmbarqueConceptosVenta(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ['conceptos_venta', embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_venta')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as ConceptoVentaRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueConceptosCosto(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ['conceptos_costo', embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_costo')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as ConceptoCostoRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueDocumentos(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ['documentos_embarque', embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_embarque')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data as DocumentoEmbarqueRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueNotas(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ['notas_embarque', embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_embarque')
        .select('*')
        .eq('embarque_id', embarqueId!)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data as NotaEmbarqueRow[];
    },
    enabled: !!embarqueId,
  });
}

export function useEmbarqueFacturas(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ['facturas', 'embarque', embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('*')
        .eq('embarque_id', embarqueId!);
      if (error) throw error;
      return data;
    },
    enabled: !!embarqueId,
  });
}

interface CreateEmbarqueInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
}

export function useCreateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarque, conceptosVenta, conceptosCosto, documentos }: CreateEmbarqueInput) => {
      // Insert embarque
      const { data: emb, error: embError } = await supabase
        .from('embarques')
        .insert(embarque)
        .select()
        .single();
      if (embError) throw embError;

      const embarqueId = emb.id;

      // Insert subentities in parallel
      const promises: PromiseLike<any>[] = [];

      if (conceptosVenta.length > 0) {
        promises.push(
          supabase.from('conceptos_venta').insert(
            conceptosVenta.map(cv => ({ ...cv, embarque_id: embarqueId }))
          ).select().then(r => r)
        );
      }
      if (conceptosCosto.length > 0) {
        promises.push(
          supabase.from('conceptos_costo').insert(
            conceptosCosto.map(cc => ({ ...cc, embarque_id: embarqueId }))
          ).select().then(r => r)
        );
      }
      if (documentos.length > 0) {
        promises.push(
          supabase.from('documentos_embarque').insert(
            documentos.map(d => ({ ...d, embarque_id: embarqueId }))
          ).select().then(r => r)
        );
      }

      // Add creation note
      promises.push(
        supabase.from('notas_embarque').insert({
          embarque_id: embarqueId,
          contenido: 'Embarque creado',
          tipo: 'sistema' as const,
        }).select().then(r => r)
      );

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r.error) throw r.error;
      }

      return emb;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
    },
  });
}

export function useClientesForSelect() {
  return useQuery({
    queryKey: ['clientes', 'select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });
}

export function useProveedoresForSelect() {
  return useQuery({
    queryKey: ['proveedores', 'select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });
}

export function useContactosCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['contactos_cliente', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contactos_cliente')
        .select('*')
        .eq('cliente_id', clienteId!);
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });
}
