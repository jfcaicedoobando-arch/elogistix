/**
 * Mutations de documentos del embarque: subir, eliminar, crear fila y marcar No Aplica.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  uploadDocumentoEmbarque,
  deleteDocumentoEmbarque,
  createDocumentoEmbarqueRow,
  setDocumentoEstadoNoAplica,
} from '@/features/embarques/services';

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
