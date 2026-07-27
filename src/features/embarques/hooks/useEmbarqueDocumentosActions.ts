import { useState } from "react";
import { useRegistrarActividad } from "@/hooks/shared";
import { getSignedUrl } from "@/services/storage/index";
import { getErrorMessage } from "@/lib/errors";
import {
  useUploadDocumentoEmbarque,
  useDeleteDocumentoEmbarque,
  useSetDocumentoNoAplica,
  type EmbarqueRow,
  type DocumentoEmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { descargarBlob } from "@/lib/downloadBlob";

/**
 * Hook focalizado en la gestión de documentos del embarque (upload/download/delete).
 * Separado del avance de estado para mantener responsabilidades únicas.
 */
export function useEmbarqueDocumentosActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const registrarActividad = useRegistrarActividad();
  const uploadDoc = useUploadDocumentoEmbarque();
  const deleteDoc = useDeleteDocumentoEmbarque();
  const setNoAplica = useSetDocumentoNoAplica();

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const handleUpload = async (docId: string, file: File) => {
    if (!id) return;
    try {
      await uploadDoc.mutateAsync({ embarqueId: id, docId, file });
      registrarActividad.mutate({
        accion: 'subir_documento', modulo: 'embarques',
        entidad_id: id, entidad_nombre: embarque?.expediente ?? '',
        detalles: { documento: file.name },
      });
      notifySuccess(undefined, { title: "Archivo subido correctamente" });
    } catch (err: unknown) {
      const raw = getErrorMessage(err);
      const isInvalidKey = /invalid key/i.test(raw);
      notifyError(undefined, {
        phase: "subida de documentos",
        title: "Error al subir archivo",
        description: isInvalidKey
          ? "El nombre del archivo contiene caracteres no permitidos. Renombra el archivo (sin acentos, espacios ni caracteres especiales) y vuelve a intentar."
          : raw,
        error: err,
        context: {
          embarqueId: id,
          embarqueExpediente: embarque?.expediente ?? null,
          documentoId: docId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          bucket: "documentos",
        },
        method: "HANDLE_UPLOAD",
      });
    }
  };

  const handleDeleteDoc = async (doc: DocumentoEmbarqueRow) => {
    if (!id || !doc.archivo) return;
    try {
      await deleteDoc.mutateAsync({ embarqueId: id, docId: doc.id, archivoPath: doc.archivo });
      registrarActividad.mutate({
        accion: 'eliminar_documento', modulo: 'embarques',
        entidad_id: id, entidad_nombre: embarque?.expediente ?? '',
        detalles: { documento: doc.nombre },
      });
      notifySuccess(undefined, { title: "Documento eliminado correctamente" });
    } catch (err: unknown) {
      notifyError(undefined, {
        phase: "eliminación de documento",
        title: "Error al eliminar documento",
        description: getErrorMessage(err),
        error: err,
        context: { embarqueId: id, documentoId: doc.id, archivoPath: doc.archivo, documentoNombre: doc.nombre },
        method: "HANDLE_DELETE_DOC",
      });
    }
  };

  const handleDownload = async (rutaArchivo: string, docId: string) => {
    setDownloadingDocId(docId);
    try {
      const url = await getSignedUrl(rutaArchivo);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Error al descargar el archivo");
      const blob = await response.blob();
      const fileName = rutaArchivo.split("/").pop() ?? "documento";
      descargarBlob(blob, fileName);
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error al descargar", description: getErrorMessage(err), error: err, method: "HANDLE_DOWNLOAD" });
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleToggleNoAplica = async (doc: DocumentoEmbarqueRow) => {
    if (!id) return;
    if (doc.archivo) return; // safety: no se permite si hay archivo adjunto
    const noAplica = doc.estado !== 'No aplica';
    try {
      await setNoAplica.mutateAsync({ embarqueId: id, docId: doc.id, noAplica });
      registrarActividad.mutate({
        accion: noAplica ? 'marcar_documento_no_aplica' : 'revertir_documento_no_aplica',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque?.expediente ?? '',
        detalles: { documento: doc.nombre },
      });
      notifySuccess(undefined, {
        title: noAplica
          ? `"${doc.nombre}" marcado como No aplica`
          : `"${doc.nombre}" marcado como Pendiente`,
      });
    } catch (err: unknown) {
      notifyError(undefined, {
        phase: "actualización de estado de documento",
        title: "Error al actualizar el documento",
        description: getErrorMessage(err),
        error: err,
        context: { embarqueId: id, documentoId: doc.id, documentoNombre: doc.nombre, noAplica },
        method: "HANDLE_TOGGLE_NO_APLICA",
      });
    }
  };

  return {
    handleUpload,
    handleDeleteDoc,
    handleDownload,
    handleToggleNoAplica,
    downloadingDocId,
    uploadDoc,
    deleteDoc,
    setNoAplica,
  };
}
