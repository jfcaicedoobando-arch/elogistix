import { useState, useMemo } from "react";
import { Upload, Download, Loader2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { DocumentoEmbarqueRow } from "@/hooks/embarque";
import { useCreateDocumentoEmbarque } from "@/hooks/embarque";
import { getDocsForMode } from "@/constants/embarqueConstants";
import { getDocEstadoColorClass } from "@/lib/ui/uiMappings";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  embarqueId: string;
  modo?: string;
  documentos: DocumentoEmbarqueRow[];
  canEdit: boolean;
  uploadingDocId: string | null;
  downloadingDocId: string | null;
  deletingDocId?: string | null;
  onUpload: (docId: string, file: File) => void;
  onDownload: (archivo: string, docId: string) => void;
  onDelete?: (doc: DocumentoEmbarqueRow) => void;
}

const OTRO_VALUE = "__otro__";

export function TabDocumentos({
  embarqueId, modo, documentos, canEdit, uploadingDocId, downloadingDocId, deletingDocId,
  onUpload, onDownload, onDelete,
}: Props) {
  const { toast } = useToast();
  const [docToDelete, setDocToDelete] = useState<DocumentoEmbarqueRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [nombreSel, setNombreSel] = useState<string>("");
  const [nombreLibre, setNombreLibre] = useState("");
  const [notasNuevo, setNotasNuevo] = useState("");
  const createDoc = useCreateDocumentoEmbarque();

  const sugerencias = useMemo(() => {
    const ya = new Set(documentos.map((d) => d.nombre));
    return getDocsForMode(modo ?? "").filter((n) => !ya.has(n));
  }, [documentos, modo]);

  const resetForm = () => {
    setNombreSel("");
    setNombreLibre("");
    setNotasNuevo("");
  };

  const handleCrear = async () => {
    const nombreFinal = nombreSel === OTRO_VALUE ? nombreLibre.trim() : nombreSel.trim();
    if (!nombreFinal) {
      notifyError(toast, { title: "Nombre requerido", description: "Selecciona o escribe el nombre del documento." });
      return;
    }
    try {
      await createDoc.mutateAsync({ embarqueId, nombre: nombreFinal, notas: notasNuevo.trim() || undefined });
      notifySuccess(toast, { title: "Documento agregado" });
      resetForm();
      setAddOpen(false);
    } catch (err) {
      notifyError(toast, { title: "No se pudo agregar el documento", description: getErrorMessage(err) });
    }
  };

  const columns = useMemo<ColumnDef<DocumentoEmbarqueRow, unknown>[]>(() => defineColumns<DocumentoEmbarqueRow>([
    { id: "nombre", header: "Documento", meta: { className: "font-medium" }, cell: ({ row }) => row.original.nombre },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${getDocEstadoColorClass(row.original.estado)}`} />
          <span className="text-sm">{row.original.estado}</span>
        </div>
      ),
    },
    { id: "notas", header: "Notas", meta: { className: "text-sm text-muted-foreground" }, cell: ({ row }) => row.original.notas || '-' },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const doc = row.original;
        return (
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
        );
      },
    },
  ]), [canEdit, uploadingDocId, downloadingDocId, deletingDocId, onUpload, onDownload, onDelete]);

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

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar documento</DialogTitle>
            <DialogDescription>
              Crea una nueva entrada en el checklist para luego adjuntar el archivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-nombre">Tipo de documento</Label>
              <Select value={nombreSel} onValueChange={setNombreSel}>
                <SelectTrigger id="doc-nombre">
                  <SelectValue placeholder="Selecciona un documento estándar" />
                </SelectTrigger>
                <SelectContent>
                  {sugerencias.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                  <SelectItem value={OTRO_VALUE}>Otro (nombre personalizado)…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {nombreSel === OTRO_VALUE && (
              <div className="space-y-1.5">
                <Label htmlFor="doc-nombre-libre">Nombre personalizado</Label>
                <Input
                  id="doc-nombre-libre"
                  value={nombreLibre}
                  onChange={(e) => setNombreLibre(e.target.value)}
                  placeholder="Ej. Pedimento, Certificado fitosanitario…"
                  maxLength={120}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="doc-notas">Notas (opcional)</Label>
              <Textarea
                id="doc-notas"
                value={notasNuevo}
                onChange={(e) => setNotasNuevo(e.target.value)}
                placeholder="Referencias, instrucciones, etc."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={createDoc.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={createDoc.isPending}>
              {createDoc.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
