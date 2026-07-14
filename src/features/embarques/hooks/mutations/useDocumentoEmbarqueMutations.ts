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
import { notifyError, notifySuccess } from '@/components/shared/utils/appFeedback';

/**
 * Invalida las caches que dependen del estado de documentos del embarque:
 * lista/detalle de documentos, embarque y reporte de auditoría (regla
 * `docs_faltantes`). Sin esto, la vista `/auditoria` mostraría datos rancios
 * hasta el próximo `Recalcular` manual.
 */
function invalidateDocumentosCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  embarqueId: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.embarques.documentos(embarqueId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
}

export function useUploadDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, docId, file }: { embarqueId: string; docId: string; file: File }) =>
      uploadDocumentoEmbarque(embarqueId, docId, file),
    onSuccess: (_r, vars) => {
      invalidateDocumentosCaches(queryClient, vars.embarqueId);
      notifySuccess(undefined, { title: "Documento subido" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al subir documento: ${error.message}`, error, method: "UPLOAD_DOC_EMBARQUE" });
    },
  });
}

export function useDeleteDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, archivoPath }: { embarqueId: string; docId: string; archivoPath: string }) =>
      deleteDocumentoEmbarque(docId, archivoPath),
    onSuccess: (_r, vars) => {
      invalidateDocumentosCaches(queryClient, vars.embarqueId);
      notifySuccess(undefined, { title: "Documento eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar documento: ${error.message}`, error, method: "DELETE_DOC_EMBARQUE" });
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
      invalidateDocumentosCaches(queryClient, vars.embarqueId);
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear documento: ${error.message}`, error, method: "CREATE_DOC_EMBARQUE" });
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
      invalidateDocumentosCaches(queryClient, vars.embarqueId);
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al marcar documento: ${error.message}`, error, method: "SET_DOC_NO_APLICA" });
    },
  });
}
