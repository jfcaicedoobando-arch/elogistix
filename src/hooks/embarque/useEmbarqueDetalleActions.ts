import type { EmbarqueRow } from "@/hooks/useEmbarques";
import { useEmbarqueEstadoActions, getSiguienteEstado } from "@/hooks/embarque/useEmbarqueEstadoActions";
import { useEmbarqueDocumentosActions } from "@/hooks/embarque/useEmbarqueDocumentosActions";

// Re-export para preservar la API pública (EmbarqueDetalle.tsx importa desde aquí)
export { getSiguienteEstado };

/**
 * Orquestador de acciones del detalle de embarque.
 * Combina los hooks especializados de estado y documentos en una API estable
 * para el componente de página, sin mezclar responsabilidades internas.
 */
export function useEmbarqueDetalleActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const estado = useEmbarqueEstadoActions(embarque, id);
  const docs = useEmbarqueDocumentosActions(embarque, id);

  return {
    handleUpload: docs.handleUpload,
    handleDeleteDoc: docs.handleDeleteDoc,
    handleDownload: docs.handleDownload,
    handleAvanzarEstado: estado.handleAvanzarEstado,
    downloadingDocId: docs.downloadingDocId,
    avanzarEstado: estado.avanzarEstado,
    uploadDoc: docs.uploadDoc,
    deleteDoc: docs.deleteDoc,
  };
}
