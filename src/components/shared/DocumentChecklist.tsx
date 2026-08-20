import { useRef, useState } from "react";
import { Check, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { notifyError } from "@/lib/ui/appFeedback";

export type { DocumentoChecklist } from "@/types/documentoChecklist";
import type { DocumentoChecklist } from "@/types/documentoChecklist";

/** EC-15 — Extensiones aceptadas por defecto (documentos de embarque). */
const ACCEPT_DEFAULT = ".pdf,.jpg,.jpeg,.png,.xml,.xlsx,.xls,.doc,.docx";
/** EC-15 — Tope de tamaño por defecto (MB). */
const MAX_SIZE_MB_DEFAULT = 15;

interface Props {
  documentos: DocumentoChecklist[];
  onFileChange: (docNombre: string, file: File | undefined) => void;
  descripcion?: string;
  /** Lista `accept` del input de archivo. Default: documentos ofimáticos e imágenes. */
  accept?: string;
  /** Tamaño máximo por archivo en MB. Default: 15. */
  maxSizeMb?: number;
}

export default function DocumentChecklist({
  documentos,
  onFileChange,
  descripcion,
  accept = ACCEPT_DEFAULT,
  maxSizeMb = MAX_SIZE_MB_DEFAULT,
}: Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const extensionesOk = accept.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  const handleSeleccion = (docNombre: string, file: File | undefined, input: HTMLInputElement) => {
    if (!file) {
      onFileChange(docNombre, undefined);
      return;
    }
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (extensionesOk.length > 0 && !extensionesOk.includes(ext)) {
      input.value = "";
      notifyError(undefined, { title: "Tipo de archivo no permitido", description: `Se aceptan: ${accept}` });
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      input.value = "";
      notifyError(undefined, { title: "Archivo demasiado grande", description: `El máximo permitido es ${maxSizeMb} MB.` });
      return;
    }
    onFileChange(docNombre, file);
  };

  return (
    <div className="space-y-3">
      {descripcion && (
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      )}
      {documentos.map((doc) => (
        <div key={doc.nombre} className="flex items-center justify-between gap-2 rounded-md border p-3">
          <div className="flex items-center gap-2 min-w-0">
            {doc.adjuntado ? (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
            )}
            <div className="min-w-0">
              <span className="text-sm font-medium">{doc.nombre}</span>
              {doc.requerido === false && (
                <span className="ml-2 text-2xs uppercase tracking-wide text-muted-foreground">Opcional</span>
              )}
              {doc.archivo && (
                <p className="text-xs text-muted-foreground truncate">{doc.archivo}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={doc.adjuntado ? "secondary" : "outline"}
              size="sm"
              onClick={() => fileInputRefs.current[doc.nombre]?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {doc.adjuntado ? 'Cambiar' : 'Adjuntar'}
            </Button>
            {doc.adjuntado && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setPendingDelete(doc.nombre)}
                aria-label={`Eliminar archivo ${doc.nombre}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
          <input
            ref={el => { fileInputRefs.current[doc.nombre] = el; }}
            type="file"
            accept={accept}
            className="hidden"
            onChange={e => handleSeleccion(doc.nombre, e.target.files?.[0], e.currentTarget)}
          />
        </div>
      ))}

      <ConfirmActionDialog
        open={!!pendingDelete}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title="¿Eliminar archivo?"
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (pendingDelete) onFileChange(pendingDelete, undefined);
          setPendingDelete(null);
        }}
        description={
          <>Se eliminará el archivo adjunto de <strong>{pendingDelete}</strong>. Esta acción no se puede deshacer.</>
        }
      />
    </div>
  );
}
