import { useState } from "react";
import { Upload, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DocumentoEmbarqueRow } from "@/hooks/useEmbarques";

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

  return (
    <>
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.map(doc => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.nombre}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${
                      doc.estado === 'Validado' ? 'bg-success' : doc.estado === 'Recibido' ? 'bg-warning' : 'bg-destructive'
                    }`} />
                    <span className="text-sm">{doc.estado}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{doc.notas || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingDocId === doc.id}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
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
                          onClick={() => onDownload(doc.archivo!, doc.id)}
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
                            onClick={() => onDelete(doc)}
                          >
                            {deletingDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                            Eliminar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {documentos.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Sin documentos registrados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
