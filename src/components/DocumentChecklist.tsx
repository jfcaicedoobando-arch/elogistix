import { useRef } from "react";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DocumentoChecklist {
  nombre: string;
  archivo?: string;
  adjuntado: boolean;
}

interface Props {
  documentos: DocumentoChecklist[];
  onFileChange: (docNombre: string, file: File | undefined) => void;
  descripcion?: string;
}

export default function DocumentChecklist({ documentos, onFileChange, descripcion }: Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
              {doc.archivo && (
                <p className="text-xs text-muted-foreground truncate">{doc.archivo}</p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant={doc.adjuntado ? "secondary" : "outline"}
            size="sm"
            onClick={() => fileInputRefs.current[doc.nombre]?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {doc.adjuntado ? 'Cambiar' : 'Adjuntar'}
          </Button>
          <input
            ref={el => { fileInputRefs.current[doc.nombre] = el; }}
            type="file"
            className="hidden"
            onChange={e => onFileChange(doc.nombre, e.target.files?.[0])}
          />
        </div>
      ))}
    </div>
  );
}
