/**
 * Mutations: actualización de embarques (datos generales y cambios de estado).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query';
import {
  actualizarEmbarqueRpc,
  actualizarEstadoEmbarque,
  avanzarEstadoEmbarqueRpc,
  reabrirEmbarqueRpc,
  insertarNotaEmbarque,
  insertEventoEmbarque,
  uploadDocumentoEmbarque,
  deleteDocumentoEmbarque,
  createDocumentoEmbarqueRow,
  setDocumentoEstadoNoAplica,
} from '@/features/embarques/services';
import { sincronizarContenedores } from '@/features/embarques/services/contenedores';
import type { ContenedorBorrador } from '@/features/embarques/types/contenedor';
import { CONTENEDORES_QUERY_KEY } from '@/features/embarques/hooks/useContenedoresEmbarque';
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
} from '@/features/embarques/domain/embarque';
import { newRequestId } from '@/lib/idempotency';

type EmbarqueRow = Tables<'embarques'>;

interface UpdateEmbarqueInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  /** Lista de contenedores hijos (Fase 2 v12.11.0). Si se omite, no se sincronizan. */
  contenedores?: ContenedorBorrador[];
  /** Idempotency key (A.3). */
  requestId?: string;
}

export function useUpdateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmbarqueInput) => {
      await actualizarEmbarqueRpc({ ...input, requestId: input.requestId ?? newRequestId() });
      if (input.contenedores !== undefined) {
        await sincronizarContenedores(input.id, input.contenedores);
      }
      return { id: input.id } as EmbarqueRow;
    },
    onSuccess: (embarqueActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: [CONTENEDORES_QUERY_KEY, embarqueActualizado.id] });
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
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail, requestId }: { embarqueId: string; nuevoEstado: string; usuarioEmail: string; requestId?: string }) => {
      await avanzarEstadoEmbarqueRpc({
        embarqueId,
        nuevoEstado,
        usuarioEmail,
        tipoEvento: tipoEventoParaEstado(nuevoEstado),
        descripcionEvento: descripcionEventoCambioEstado(nuevoEstado),
        requestId: requestId ?? newRequestId(),
      });
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
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: { embarqueId: string; nuevoEstado: string; usuarioEmail?: string }) => {
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarEventoTracking(embarqueId, nuevoEstado, usuarioEmail && usuarioEmail.trim() ? usuarioEmail : 'sistema');
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}

/**
 * Reabre un embarque cerrado (Cerrado → Entregado). Solo admin/super_admin.
 * El backend valida el rol y rechaza si el estado actual no es Cerrado.
 */
export function useReabrirEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, usuarioEmail, requestId }: { embarqueId: string; usuarioEmail: string; requestId?: string }) => {
      await reabrirEmbarqueRpc({
        embarqueId,
        usuarioEmail,
        requestId: requestId ?? newRequestId(),
      });
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
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

/**
 * Inserta una nueva fila vacía en `documentos_embarque` para que el operador
 * pueda adjuntar un archivo desde el detalle aunque el checklist inicial esté
 * incompleto. RLS de la tabla aplica tenancy automáticamente.
 */
export function useCreateDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, nombre, notas }: { embarqueId: string; nombre: string; notas?: string }) =>
      createDocumentoEmbarqueRow({ embarqueId, nombre, notas }),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}

/**
 * Marca un documento como "No aplica" (o lo revierte a "Pendiente").
 * Usado para excluir documentos opcionales del checklist de "faltantes".
 */
export function useSetDocumentoNoAplica() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, noAplica }: { embarqueId: string; docId: string; noAplica: boolean }) =>
      setDocumentoEstadoNoAplica(docId, noAplica),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}
