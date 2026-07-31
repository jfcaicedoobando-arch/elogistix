/**
 * Ranuras de archivo del buzón CxP: PDF de la factura y XML del CFDI, con
 * zona de arrastrar y soltar que acomoda ambos archivos por extensión.
 */
import { useRef, useState } from "react";
import { FileText, FileCode2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TAMANO_MAX_ENTRANTE_MB } from "@/lib/domain/facturasEntrantes";

interface SlotProps {
  titulo: string;
  ayuda: string;
  archivo: File | null;
  icono: typeof FileText;
  onQuitar: () => void;
}

function ArchivoSlot({ titulo, ayuda, archivo, icono: Icono, onQuitar }: SlotProps) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-md border p-3",
      archivo ? "border-primary/40 bg-primary/5" : "border-dashed",
    )}>
      <Icono className={cn("mt-0.5 h-4 w-4 shrink-0", archivo ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{titulo}</p>
        {archivo ? (
          <p className="truncate text-xs text-muted-foreground">{archivo.name}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{ayuda}</p>
        )}
      </div>
      {archivo && (
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={onQuitar} aria-label={`Quitar ${titulo}`}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface Props {
  pdf: File | null;
  xml: File | null;
  onArchivos: (archivos: File[]) => void;
  onQuitarPdf: () => void;
  onQuitarXml: () => void;
}

export function ArchivosEntranteDropZone({ pdf, xml, onArchivos, onQuitarPdf, onQuitarXml }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          onArchivos(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center transition-colors",
          sobre ? "border-primary bg-primary/10" : "hover:bg-muted/50",
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium">Arrastra el PDF y el XML, o haz clic para elegirlos</span>
        <span className="text-xs text-muted-foreground">
          Puedes seleccionar los dos a la vez · máx. {TAMANO_MAX_ENTRANTE_MB} MB por archivo
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.xml,application/pdf,text/xml,application/xml"
        onChange={(e) => {
          onArchivos(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <ArchivoSlot
          titulo="PDF de la factura"
          ayuda="Representación impresa de la factura"
          archivo={pdf}
          icono={FileText}
          onQuitar={onQuitarPdf}
        />
        <ArchivoSlot
          titulo="XML del CFDI"
          ayuda="Obligatorio en proveedores mexicanos"
          archivo={xml}
          icono={FileCode2}
          onQuitar={onQuitarXml}
        />
      </div>
    </div>
  );
}
