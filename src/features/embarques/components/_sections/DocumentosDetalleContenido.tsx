import type { DocumentoEmbarqueRow, EmbarqueRow } from "@/features/embarques/types/embarque";
import { useEmbarqueDocumentosActions } from "@/features/embarques/hooks/useEmbarqueDocumentosActions";
import { TabDocumentos } from "../TabDocumentos";

interface Props {
  embarque: EmbarqueRow;
  documentos: DocumentoEmbarqueRow[];
  canEdit: boolean;
}

export default function DocumentosDetalleContenido({ embarque, documentos, canEdit }: Props) {
  const docs = useEmbarqueDocumentosActions(embarque, embarque.id);
  return (
    <TabDocumentos
      embarqueId={embarque.id}
      modo={embarque.modo}
      documentos={documentos}
      canEdit={canEdit}
      uploadingDocId={docs.uploadDoc.isPending ? docs.uploadDoc.variables?.docId ?? null : null}
      downloadingDocId={docs.downloadingDocId}
      deletingDocId={docs.deleteDoc.isPending ? docs.deleteDoc.variables?.docId ?? null : null}
      togglingNoAplicaDocId={docs.setNoAplica.isPending ? docs.setNoAplica.variables?.docId ?? null : null}
      rechazandoDocId={docs.rechazarDoc.isPending ? docs.rechazarDoc.variables?.docId ?? null : null}
      onUpload={docs.handleUpload}
      onDownload={docs.handleDownload}
      onDelete={docs.handleDeleteDoc}
      onToggleNoAplica={docs.handleToggleNoAplica}
      onRechazar={docs.handleRechazarDoc}
    />
  );
}
