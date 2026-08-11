/**
 * v13.503.0 — Zona única de carga del buzón CxP (arrastrar o hacer clic) más
 * los chips de estado de PDF/XML. Antes había tres recuadros: la zona grande y
 * dos ranuras punteadas que se confundían con más zonas de carga.
 */
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAMANO_MAX_ENTRANTE_MB } from "@/lib/domain/facturasEntrantes";
import { ArchivosEntranteChips } from "@/features/embarques/components/entrantes/ArchivosEntranteChips";

interface Props {
  pdf: File | null;
  xml: File | null;
  onArchivos: (archivos: File[]) => void;
  onQuitarPdf: () => void;
  onQuitarXml: () => void;
}

export function ArchivosEntranteDropZone({
  pdf,
  xml,
  onArchivos,
  onQuitarPdf,
  onQuitarXml,
}: Props) {
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
          "flex w-full flex-col items-center gap-1 rounded-md border border-dashed p-5 text-center transition-colors",
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
      <ArchivosEntranteChips
        pdf={pdf}
        xml={xml}
        onQuitarPdf={onQuitarPdf}
        onQuitarXml={onQuitarXml}
      />
    </div>
  );
}
