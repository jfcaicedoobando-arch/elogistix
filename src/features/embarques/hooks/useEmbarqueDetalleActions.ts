import type { EmbarqueRow } from "@/features/embarques/hooks/useEmbarques";
import { useEmbarqueEstadoActions, getSiguienteEstado } from "@/features/embarques/hooks/useEmbarqueEstadoActions";
import { useEmbarqueDocumentosActions } from "@/features/embarques/hooks/useEmbarqueDocumentosActions";

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
    handleToggleNoAplica: docs.handleToggleNoAplica,
    handleAvanzarEstado: estado.handleAvanzarEstado,
    handleReabrir: estado.handleReabrir,
    reabrirEmbarque: estado.reabrirEmbarque,
    warnCierreOpen: estado.warnCierreOpen,
    setWarnCierreOpen: estado.setWarnCierreOpen,
    confirmarCierreSinProforma: estado.confirmarCierreSinProforma,
    conceptosSinProforma: estado.conceptosSinProforma,
    docsFaltantes: estado.docsFaltantes,
    docsBloqueantes: estado.docsBloqueantes,
    warnDocsOpen: estado.warnDocsOpen,
    setWarnDocsOpen: estado.setWarnDocsOpen,
    blockDocsOpen: estado.blockDocsOpen,
    setBlockDocsOpen: estado.setBlockDocsOpen,
    blockFechaLlegadaOpen: estado.blockFechaLlegadaOpen,
    setBlockFechaLlegadaOpen: estado.setBlockFechaLlegadaOpen,
    confirmarAvanceConDocsPendientes: estado.confirmarAvanceConDocsPendientes,

    downloadingDocId: docs.downloadingDocId,
    avanzarEstado: estado.avanzarEstado,
    uploadDoc: docs.uploadDoc,
    deleteDoc: docs.deleteDoc,
    setNoAplica: docs.setNoAplica,
    // v13.89.1 — Cierre gateado
    cierreEsSiguiente: estado.cierreEsSiguiente,
    rolPuedeCerrar: estado.rolPuedeCerrar,
    cierrePuedeAvanzar: estado.cierrePuedeAvanzar,
    cierreMotivoBloqueo: estado.cierreMotivoBloqueo,
  };
}
