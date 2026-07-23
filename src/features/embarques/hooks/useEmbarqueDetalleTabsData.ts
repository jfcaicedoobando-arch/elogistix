/**
 * `useEmbarqueDetalleTabsData` — Data-fetching + acciones consumidas por
 * `EmbarqueDetalleTabs`, extraído del contenedor de ruta.
 *
 * v13.309.24 · Cierra el Ítem 3.5 de la auditoría de arquitectura 3:
 *   > Data-fetching aún en el padre. Mover a `useEmbarqueDetalleTabsData(embarqueId)`.
 *
 * Compone tres hooks especializados que antes vivían en la ruta:
 *   - `useEmbarqueDetalleData`     → embarque + colecciones (documentos, conceptos, facturas, notas)
 *   - `useEmbarqueFinancials`      → total venta/costo/utilidad/margen convertidos a MXN
 *   - `useEmbarqueDocumentosActions` → mutations + handlers de upload/delete/download/no-aplica
 *
 * Devuelve además el bundle `docHandlers` ya derivado (uploadingDocId, deletingDocId,
 * togglingNoAplicaDocId) para que los tabs no dupliquen el cálculo de `.isPending`.
 *
 * La ruta sigue llamando a `useEmbarqueDetalleData(id)` para obtener `embarque` + `isLoading`
 * (early return del layout). React Query comparte el caché entre ambas suscripciones,
 * de modo que no hay fetch duplicado; sólo hay dos instancias de `useMutation` para
 * documentos — una en el header (bloqueos de avance) y otra en los tabs (upload real).
 */
import {
  useEmbarqueDetalleData,
  useEmbarqueFinancials,
  useEmbarqueDocumentosActions,
} from "@/features/embarques/hooks";
import type { EmbarqueRow } from "@/features/embarques/hooks/useEmbarques";

export function useEmbarqueDetalleTabsData(
  embarqueId: string | undefined,
  embarque: EmbarqueRow | undefined,
) {
  const {
    conceptosVenta, conceptosCosto, documentos, notas, facturas,
    tipoCambioUSD, tipoCambioEUR,
  } = useEmbarqueDetalleData(embarqueId);

  const financials = useEmbarqueFinancials({
    conceptosVenta, conceptosCosto, tipoCambioUSD, tipoCambioEUR,
  });

  const docs = useEmbarqueDocumentosActions(embarque, embarqueId);

  const docHandlers = {
    uploadingDocId: docs.uploadDoc.isPending ? (docs.uploadDoc.variables?.docId ?? null) : null,
    downloadingDocId: docs.downloadingDocId,
    deletingDocId: docs.deleteDoc.isPending ? (docs.deleteDoc.variables?.docId ?? null) : null,
    togglingNoAplicaDocId: docs.setNoAplica.isPending ? (docs.setNoAplica.variables?.docId ?? null) : null,
    onUpload: docs.handleUpload,
    onDownload: docs.handleDownload,
    onDelete: docs.handleDeleteDoc,
    onToggleNoAplica: docs.handleToggleNoAplica,
  };

  return { conceptosCosto, documentos, notas, facturas, financials, docHandlers };
}
