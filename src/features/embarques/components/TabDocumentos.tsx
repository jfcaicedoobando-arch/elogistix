import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/shared/DataTable";
import type { DocumentoEmbarqueRow } from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { AgregarDocumentoDialog } from "./tabDocumentos/AgregarDocumentoDialog";
import { useDocumentoColumns } from "./tabDocumentos/useDocumentoColumns";

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

  const columns = useDocumentoColumns({
    canEdit, uploadingDocId, downloadingDocId, deletingDocId, togglingNoAplicaDocId,
    onUpload, onDownload, onDelete, onToggleNoAplica,
    onRequestDelete: setDocToDelete,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base font-semibold">Documentos del embarque</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar documento
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={documentos}
            rowKey={(d) => d.id}
            emptyMessage={canEdit
              ? 'Sin documentos registrados. Usa "Agregar documento" para crear el primero.'
              : 'Sin documentos registrados'}
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

      <AlertDialog open={!!docToDelete} onOpenChange={(open) => { if (!open) setDocToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              El archivo <strong>{docToDelete?.nombre}</strong> será eliminado permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (docToDelete && onDelete) onDelete(docToDelete);
                setDocToDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
