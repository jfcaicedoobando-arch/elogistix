import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { getSignedUrl } from "@/services/storage";
import { getErrorMessage } from "@/lib/errors";
import {
  useUploadDocumentoEmbarque,
  useDeleteDocumentoEmbarque,
  type EmbarqueRow,
  type DocumentoEmbarqueRow,
} from "@/hooks/useEmbarques";

/**
 * Hook focalizado en la gestión de documentos del embarque (upload/download/delete).
 * Separado del avance de estado para mantener responsabilidades únicas.
 */
export function useEmbarqueDocumentosActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { toast } = useToast();
  const registrarActividad = useRegistrarActividad();
  const uploadDoc = useUploadDocumentoEmbarque();
  const deleteDoc = useDeleteDocumentoEmbarque();

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
      toast({ title: "Archivo subido correctamente" });
    } catch (err: unknown) {
      const raw = getErrorMessage(err);
      const isInvalidKey = /invalid key/i.test(raw);
      toast({
        title: "Error al subir archivo",
        description: isInvalidKey
          ? "El nombre del archivo contiene caracteres no permitidos. Renombra el archivo (sin acentos, espacios ni caracteres especiales) y vuelve a intentar."
          : raw,
        variant: "destructive",
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
      toast({ title: "Documento eliminado correctamente" });
    } catch (err: unknown) {
      toast({ title: "Error al eliminar documento", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleDownload = async (rutaArchivo: string, docId: string) => {
    setDownloadingDocId(docId);
    try {
      const url = await getSignedUrl(rutaArchivo);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Error al descargar el archivo");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const fileName = rutaArchivo.split("/").pop() ?? "documento";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      toast({ title: "Error al descargar", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDownloadingDocId(null);
    }
  };

  return {
    handleUpload,
    handleDeleteDoc,
    handleDownload,
    downloadingDocId,
    uploadDoc,
    deleteDoc,
  };
}
