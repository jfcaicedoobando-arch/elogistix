/**
 * Mutations de documentos del embarque: subir, eliminar, crear fila y marcar No Aplica.
 */
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { useMutationWithFeedback } from '@/hooks/shared';
import {
  uploadDocumentoEmbarque,
  deleteDocumentoEmbarque,
  createDocumentoEmbarqueRow,
  setDocumentoEstadoNoAplica,
} from '@/features/embarques/services';

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
  return useMutationWithFeedback({
    mutationFn: ({ embarqueId, docId, file }: { embarqueId: string; docId: string; file: File }) =>
      uploadDocumentoEmbarque(embarqueId, docId, file),
    successTitle: "Documento subido",
    errorTitle: "Error al subir documento",
    errorMethod: "UPLOAD_DOC_EMBARQUE",
    onSuccess: (_r, vars) => invalidateDocumentosCaches(queryClient, vars.embarqueId),
  });
}

export function useDeleteDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ docId, archivoPath }: { embarqueId: string; docId: string; archivoPath: string }) =>
      deleteDocumentoEmbarque(docId, archivoPath),
    successTitle: "Documento eliminado",
    errorTitle: "Error al eliminar documento",
    errorMethod: "DELETE_DOC_EMBARQUE",
    onSuccess: (_r, vars) => invalidateDocumentosCaches(queryClient, vars.embarqueId),
  });
}

/**
 * Inserta una nueva fila vacía en `documentos_embarque` para que el operador
 * pueda adjuntar un archivo desde el detalle aunque el checklist inicial esté
 * incompleto. RLS de la tabla aplica tenancy automáticamente.
 */
export function useCreateDocumentoEmbarque() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ embarqueId, nombre, notas }: { embarqueId: string; nombre: string; notas?: string }) =>
      createDocumentoEmbarqueRow({ embarqueId, nombre, notas }),
    errorTitle: "Error al crear documento",
    errorMethod: "CREATE_DOC_EMBARQUE",
    onSuccess: (_r, vars) => invalidateDocumentosCaches(queryClient, vars.embarqueId),
  });
}

/**
 * Marca un documento como "No aplica" (o lo revierte a "Pendiente").
 * Usado para excluir documentos opcionales del checklist de "faltantes".
 */
export function useSetDocumentoNoAplica() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ docId, noAplica }: { embarqueId: string; docId: string; noAplica: boolean }) =>
      setDocumentoEstadoNoAplica(docId, noAplica),
    errorTitle: "Error al marcar documento",
    errorMethod: "SET_DOC_NO_APLICA",
    onSuccess: (_r, vars) => invalidateDocumentosCaches(queryClient, vars.embarqueId),
  });
}
