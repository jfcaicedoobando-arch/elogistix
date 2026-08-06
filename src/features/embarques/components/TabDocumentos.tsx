import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { DataTable } from "@/components/shared/DataTable";
import type { DocumentoEmbarqueRow } from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { AgregarDocumentoDialog } from "./tabDocumentos/AgregarDocumentoDialog";
import { useDocumentoColumns } from "@/features/embarques/hooks/useDocumentoColumns";

interface Props {
  embarqueId: string;
  modo?: string;
  documentos: DocumentoEmbarqueRow[];
  canEdit: boolean;
  uploadingDocId: string | null;
  downloadingDocId: string | null;
  deletingDocId?: string | null;
  togglingNoAplicaDocId?: string | null;
  onUpload: (docId: string, file: File) => void;
  onDownload: (archivo: string, docId: string) => void;
  onDelete?: (doc: DocumentoEmbarqueRow) => void;
  onToggleNoAplica?: (doc: DocumentoEmbarqueRow) => void;
}

export function TabDocumentos({
  embarqueId, modo, documentos, canEdit, uploadingDocId, downloadingDocId, deletingDocId, togglingNoAplicaDocId,
  onUpload, onDownload, onDelete, onToggleNoAplica,
}: Props) {
  const [docToDelete, setDocToDelete] = useState<DocumentoEmbarqueRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { focus, registerRef, clearFocus } = useFocusSection();
  const filtrarFaltantes = focus === "faltantes";

  const documentosVisibles = useMemo(() => {
    if (!filtrarFaltantes) return documentos;
    return documentos.filter(d => (!d.archivo || d.archivo === '') && d.estado !== 'No aplica');
  }, [documentos, filtrarFaltantes]);

  const columns = useDocumentoColumns({
    canEdit, uploadingDocId, downloadingDocId, deletingDocId, togglingNoAplicaDocId,
    onUpload, onDownload, onDelete, onToggleNoAplica,
    onRequestDelete: setDocToDelete,
  });

  return (
    <>
      <Card ref={registerRef("faltantes")} data-focus="faltantes">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <CardTitle >Documentos del embarque</CardTitle>
            {filtrarFaltantes && (
              <>
                <Badge variant="outline" className="border-primary text-primary">
                  Filtrando: documentos faltantes
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearFocus}>
                  <X className="mr-1 h-3 w-3" /> Limpiar
                </Button>
              </>
            )}
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar documento
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={documentosVisibles}
            rowKey={(d) => d.id}
            emptyMessage={filtrarFaltantes
              ? 'No hay documentos faltantes; todos tienen archivo cargado.'
              : (canEdit
                ? 'Sin documentos registrados. Usa "Agregar documento" para crear el primero.'
                : 'Sin documentos registrados')}
          />
        </CardContent>
      </Card>


      <AgregarDocumentoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        embarqueId={embarqueId}
        modo={modo}
        documentos={documentos}
      />

      <ConfirmActionDialog
        open={!!docToDelete}
        onOpenChange={(open) => { if (!open) setDocToDelete(null); }}
        title="¿Eliminar documento?"
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (docToDelete && onDelete) onDelete(docToDelete);
          setDocToDelete(null);
        }}
        description={
          <>El archivo <strong>{docToDelete?.nombre}</strong> será eliminado permanentemente. Esta acción no se puede deshacer.</>
        }
      />
    </>
  );
}
