import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { getSignedUrl } from "@/lib/storage";
import { getErrorMessage } from "@/lib/errorUtils";
import { ESTADO_TIMELINE } from "@/data/embarqueConstants";
import {
  useAvanzarEstadoEmbarque,
  useSyncEstadoEmbarque,
  useUploadDocumentoEmbarque,
  useDeleteDocumentoEmbarque,
  calcularEstadoEmbarque,
  type EmbarqueRow,
  type DocumentoEmbarqueRow,
} from "@/hooks/useEmbarques";

export function getSiguienteEstado(estadoActual: string) {
  const idx = ESTADO_TIMELINE.indexOf(estadoActual as typeof ESTADO_TIMELINE[number]);
  if (idx < 0 || idx >= ESTADO_TIMELINE.length - 1) return null;
  return ESTADO_TIMELINE[idx + 1];
}

export function useEmbarqueDetalleActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { toast } = useToast();
  const { user } = useAuth();
  const registrarActividad = useRegistrarActividad();
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const syncEstado = useSyncEstadoEmbarque();
  const uploadDoc = useUploadDocumentoEmbarque();
  const deleteDoc = useDeleteDocumentoEmbarque();

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Auto-sync estado calculado a BD
  useEffect(() => {
    if (!embarque) return;
    const estadoCalculado = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
    if (estadoCalculado !== embarque.estado) {
      syncEstado.mutate({ embarqueId: embarque.id, nuevoEstado: estadoCalculado });
    }
  }, [embarque?.id, embarque?.etd, embarque?.eta]);

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
      toast({ title: "Error al subir archivo", description: getErrorMessage(err), variant: "destructive" });
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
      window.open(url, "_blank");
    } catch (err: unknown) {
      toast({ title: "Error al descargar", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    try {
      await avanzarEstado.mutateAsync({ embarqueId: id, nuevoEstado: siguiente, usuarioEmail: user?.email ?? '' });
      registrarActividad.mutate({
        accion: 'cambiar_estado', modulo: 'embarques',
        entidad_id: id, entidad_nombre: embarque.expediente,
        detalles: { estado_anterior: embarque.estado, estado_nuevo: siguiente },
      });
      toast({ title: `Estado actualizado a "${siguiente}"` });
    } catch (err: unknown) {
      toast({ title: "Error al cambiar estado", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return {
    handleUpload,
    handleDeleteDoc,
    handleDownload,
    handleAvanzarEstado,
    downloadingDocId,
    avanzarEstado,
    uploadDoc,
    deleteDoc,
  };
}
