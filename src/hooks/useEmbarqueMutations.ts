import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import type { EmbarqueRow } from './useEmbarqueUtils';
import { queryKeys } from '@/lib/queryKeys';

type EmbarqueInsert = TablesInsert<'embarques'>;

// ─── Create ──────────────────────────────────────────────
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
      const { data, error } = await supabase.rpc('crear_embarque_completo', {
        p_embarque: embarque as unknown as Record<string, unknown>,
        p_conceptos_venta: conceptosVenta as unknown as Record<string, unknown>[],
        p_conceptos_costo: conceptosCosto as unknown as Record<string, unknown>[],
        p_documentos: documentos as unknown as Record<string, unknown>[],
      });
      if (error) throw error;
      const result = data as unknown as { id: string };
      return { id: result.id } as unknown as EmbarqueRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}

// ─── Update ──────────────────────────────────────────────
interface UpdateEmbarqueInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
}

export function useUpdateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, embarque, conceptosVenta, conceptosCosto }: UpdateEmbarqueInput) => {
      const { error } = await supabase.rpc('actualizar_embarque_completo', {
        p_embarque_id: id,
        p_embarque: embarque as unknown as Record<string, unknown>,
        p_conceptos_venta: conceptosVenta as unknown as Record<string, unknown>[],
        p_conceptos_costo: conceptosCosto as unknown as Record<string, unknown>[],
      });
      if (error) throw error;
      return { id } as EmbarqueRow;
    },
    onSuccess: (embarqueActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueActualizado.id) });
    },
  });
}

// ─── Duplicar ────────────────────────────────────────────
interface DuplicarEmbarqueInput {
  embarqueOrigen: EmbarqueRow;
  copias: Array<{
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }>;
}

export function useDuplicarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueOrigen, copias }: DuplicarEmbarqueInput) => {
      const { data, error } = await supabase.rpc('duplicar_embarque_completo', {
        p_embarque_origen_id: embarqueOrigen.id,
        p_copias: copias as unknown as Record<string, unknown>[],
      });
      if (error) throw error;
      return data as unknown as { id: string; expediente: string }[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}

// ─── Avanzar Estado ──────────────────────────────────────
export function useAvanzarEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: { embarqueId: string; nuevoEstado: string; usuarioEmail: string }) => {
      const { error: errorEstado } = await supabase
        .from('embarques')
        .update({ estado: nuevoEstado as EmbarqueInsert['estado'] })
        .eq('id', embarqueId);
      if (errorEstado) throw errorEstado;

      const { error: errorNota } = await supabase
        .from('notas_embarque')
        .insert({
          embarque_id: embarqueId,
          contenido: `Estado cambiado a "${nuevoEstado}"`,
          tipo: 'cambio_estado' as const,
          usuario: usuarioEmail,
        });
      if (errorNota) throw errorNota;
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
    },
  });
}

// ─── Sincronizar Estado Calculado ─────────────────────────
/** Actualiza el estado en BD si el estado calculado difiere del almacenado */
export function useSyncEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado }: { embarqueId: string; nuevoEstado: string }) => {
      const { error } = await supabase
        .from('embarques')
        .update({ estado: nuevoEstado as EmbarqueInsert['estado'] })
        .eq('id', embarqueId);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}

// ─── Upload Documento ────────────────────────────────────
type DocumentoEstado = TablesInsert<'documentos_embarque'>['estado'];

export function useUploadDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, docId, file }: { embarqueId: string; docId: string; file: File }) => {
      const { uploadFile } = await import('@/lib/storage');
      const path = `embarques/${embarqueId}/${docId}/${file.name}`;
      await uploadFile(path, file);
      const { error } = await supabase
        .from('documentos_embarque')
        .update({ archivo: path, estado: 'Recibido' as DocumentoEstado })
        .eq('id', docId);
      if (error) throw error;
      return { path, fileName: file.name };
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
    },
  });
}

// ─── Delete Documento ────────────────────────────────────
export function useDeleteDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, docId, archivoPath }: { embarqueId: string; docId: string; archivoPath: string }) => {
      const { deleteFile } = await import('@/lib/storage');
      await deleteFile(archivoPath);
      const { error } = await supabase.from('documentos_embarque').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
    },
  });
}

// ─── Crear Nota ──────────────────────────────────────────
export function useCreateNotaEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, contenido, usuario }: { embarqueId: string; contenido: string; usuario: string }) => {
      const { error } = await supabase
        .from('notas_embarque')
        .insert({
          embarque_id: embarqueId,
          contenido,
          tipo: 'nota' as const,
          usuario,
        });
      if (error) throw error;
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
    },
  });
}

// ─── Eliminar ────────────────────────────────────────────
export function useEliminarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (embarqueId: string) => {
      const { error } = await supabase.rpc('eliminar_embarque_completo', {
        p_embarque_id: embarqueId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
