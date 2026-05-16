/**
 * Mutations: actualización de embarques (datos generales y cambios de estado).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query';
import { supabase } from '@/integrations/supabase/client';
import {
  actualizarEmbarqueRpc,
  actualizarEstadoEmbarque,
  avanzarEstadoEmbarqueRpc,
  insertarNotaEmbarque,
  insertEventoEmbarque,
  uploadDocumentoEmbarque,
  deleteDocumentoEmbarque,
} from '@/services/embarque';
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
} from '@/lib/domain/embarque';
import { mapNavieraToJsonCargo } from '@/lib/jsoncargo/navieras';
import { newRequestId } from '@/lib/idempotency';

type EmbarqueRow = Tables<'embarques'>;

interface UpdateEmbarqueInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
}

export function useUpdateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmbarqueInput) => {
      await actualizarEmbarqueRpc(input);
      // Auto-sync JSONCargo si aplica (fire-and-forget)
      const e = input.embarque;
      if (e.modo === 'Marítimo' && e.contenedor && mapNavieraToJsonCargo(e.naviera ?? null)) {
        supabase.functions.invoke('jsoncargo-track', { body: { embarqueId: input.id } })
          .catch((err) => console.warn('jsoncargo-track auto-sync:', err));
      }
      return { id: input.id } as EmbarqueRow;
    },
    onSuccess: (embarqueActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jsonCargo.byEmbarque(embarqueActualizado.id) });
    },
  });
}

async function insertarEventoTracking(embarqueId: string, nuevoEstado: string, usuario: string) {
  await insertEventoEmbarque({
    embarqueId,
    tipo: tipoEventoParaEstado(nuevoEstado),
    descripcion: descripcionEventoCambioEstado(nuevoEstado),
    ubicacion: '',
    fecha: new Date().toISOString(),
    usuario,
  });
}

export function useAvanzarEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: { embarqueId: string; nuevoEstado: string; usuarioEmail: string }) => {
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarNotaCambioEstado(embarqueId, `Estado cambiado a "${nuevoEstado}"`, usuarioEmail);
      await insertarEventoTracking(embarqueId, nuevoEstado, usuarioEmail);
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}

export function useSyncEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado }: { embarqueId: string; nuevoEstado: string }) => {
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarEventoTracking(embarqueId, nuevoEstado, 'sistema');
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}

export function useUploadDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, docId, file }: { embarqueId: string; docId: string; file: File }) =>
      uploadDocumentoEmbarque(embarqueId, docId, file),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
    },
  });
}

export function useDeleteDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, archivoPath }: { embarqueId: string; docId: string; archivoPath: string }) =>
      deleteDocumentoEmbarque(docId, archivoPath),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
    },
  });
}

export function useCreateNotaEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, contenido, usuario }: { embarqueId: string; contenido: string; usuario: string }) =>
      insertarNotaEmbarque(embarqueId, contenido, usuario),
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
    },
  });
}
