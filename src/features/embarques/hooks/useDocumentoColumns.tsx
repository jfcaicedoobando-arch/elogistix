import { useMemo } from "react";
import { Upload, Download, Loader2, Trash2, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { DocumentoEmbarqueRow } from "@/features/embarques/hooks";
import { getDocEstadoColorClass } from "@/lib/ui/uiMappings";

/**
 * Nombres de documentos considerados SIEMPRE obligatorios.
 * Para estos no se permite marcar "No aplica".
 */
const DOCUMENTOS_OBLIGATORIOS = new Set(["BL Master"]);

interface Options {
  canEdit: boolean;
  uploadingDocId: string | null;
  downloadingDocId: string | null;
  deletingDocId?: string | null;
  togglingNoAplicaDocId?: string | null;
  onUpload: (docId: string, file: File) => void;
  onDownload: (archivo: string, docId: string) => void;
  onDelete?: (doc: DocumentoEmbarqueRow) => void;
  onToggleNoAplica?: (doc: DocumentoEmbarqueRow) => void;
  onRequestDelete: (doc: DocumentoEmbarqueRow) => void;
}

export function useDocumentoColumns(opts: Options): ColumnDef<DocumentoEmbarqueRow, unknown>[] {
  const {
    canEdit, uploadingDocId, downloadingDocId, deletingDocId, togglingNoAplicaDocId,
    onUpload, onDownload, onDelete, onToggleNoAplica, onRequestDelete,
  } = opts;
  return useMemo<ColumnDef<DocumentoEmbarqueRow, unknown>[]>(() => defineColumns<DocumentoEmbarqueRow>([
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
        const esObligatorio = DOCUMENTOS_OBLIGATORIOS.has(doc.nombre);
        const esNoAplica = doc.estado === "No aplica";
        const puedeMarcarNoAplica =
          canEdit && !!onToggleNoAplica && !doc.archivo && !esObligatorio;
        return (
          <div className="flex gap-2">
            {canEdit && !esNoAplica && (
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
            {puedeMarcarNoAplica && (
              <Button
                variant="ghost"
                size="sm"
                disabled={togglingNoAplicaDocId === doc.id}
                onClick={(e) => { e.stopPropagation(); onToggleNoAplica!(doc); }}
                title={esNoAplica ? "Volver a marcar como pendiente" : "Marcar como no aplica para este embarque"}
              >
                {togglingNoAplicaDocId === doc.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  : esNoAplica
                    ? <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    : <Ban className="h-3.5 w-3.5 mr-1" />}
                {esNoAplica ? "Marcar pendiente" : "No aplica"}
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
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(doc); }}
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
  ]), [canEdit, uploadingDocId, downloadingDocId, deletingDocId, togglingNoAplicaDocId, onUpload, onDownload, onDelete, onToggleNoAplica, onRequestDelete]);
}
