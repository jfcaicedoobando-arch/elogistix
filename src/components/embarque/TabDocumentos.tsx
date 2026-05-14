import { useState, useMemo } from "react";
import { Upload, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import type { DocumentoEmbarqueRow } from "@/hooks/embarque/useEmbarques";

interface Props {
  documentos: DocumentoEmbarqueRow[];
  canEdit: boolean;
  uploadingDocId: string | null;
  downloadingDocId: string | null;
  deletingDocId?: string | null;
  onUpload: (docId: string, file: File) => void;
  onDownload: (archivo: string, docId: string) => void;
  onDelete?: (doc: DocumentoEmbarqueRow) => void;
}

export function TabDocumentos({ documentos, canEdit, uploadingDocId, downloadingDocId, deletingDocId, onUpload, onDownload, onDelete }: Props) {
  const [docToDelete, setDocToDelete] = useState<DocumentoEmbarqueRow | null>(null);

  const columns = useMemo<DataTableColumn<DocumentoEmbarqueRow>[]>(() => [
    { key: "nombre", header: "Documento", className: "font-medium", render: (d) => d.nombre },
    {
      key: "estado", header: "Estado", render: (d) => (
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${getDocEstadoColorClass(d.estado)}`} />
          <span className="text-sm">{d.estado}</span>
        </div>
      ),
    },
    { key: "notas", header: "Notas", className: "text-sm text-muted-foreground", render: (d) => d.notas || '-' },
    {
      key: "acciones", header: "Acciones", render: (doc) => (
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              disabled={uploadingDocId === doc.id}
              onClick={(e) => {
                e.stopPropagation();
                const input = document.createElement("input");
                input.type = "file";
                input.onchange = (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  if (file) onUpload(doc.id, file);
                };
                input.click();
              }}
            >
              {uploadingDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Subir
            </Button>
          )}
          {doc.archivo && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={downloadingDocId === doc.id}
                onClick={(e) => { e.stopPropagation(); onDownload(doc.archivo!, doc.id); }}
              >
                {downloadingDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Descargar
              </Button>
              {canEdit && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deletingDocId === doc.id}
                  onClick={(e) => { e.stopPropagation(); setDocToDelete(doc); }}
                >
                  {deletingDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                  Eliminar
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ], [canEdit, uploadingDocId, downloadingDocId, deletingDocId, onUpload, onDownload, onDelete]);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={documentos}
            rowKey={(d) => d.id}
            emptyMessage="Sin documentos registrados"
          />
        </CardContent>
      </Card>

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
