/**
 * v13.503.0 — Chips de estado de los archivos del buzón CxP.
 *
 * Antes eran dos recuadros punteados que parecían zonas de carga extra: el
 * modal se veía con "tres buzones". Ahora sólo informan qué llegó y qué falta.
 */
import { Check, FileCode2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChipProps {
  titulo: string;
  ayuda: string;
  archivo: File | null;
  icono: typeof FileText;
  onQuitar: () => void;
}

function ArchivoChip({ titulo, ayuda, archivo, icono: Icono, onQuitar }: ChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        archivo ? "border-success/40 bg-success/10" : "border-border bg-muted/40",
      )}
    >
      {archivo ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium">{titulo}</span>
      <span className="min-w-0 truncate text-muted-foreground" title={archivo?.name ?? ayuda}>
        {archivo ? archivo.name : ayuda}
      </span>
      {archivo && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          onClick={onQuitar}
          aria-label={`Quitar ${titulo}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface Props {
  pdf: File | null;
  xml: File | null;
  onQuitarPdf: () => void;
  onQuitarXml: () => void;
}

export function ArchivosEntranteChips({ pdf, xml, onQuitarPdf, onQuitarXml }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <ArchivoChip
        titulo="PDF"
        ayuda="pendiente"
        archivo={pdf}
        icono={FileText}
        onQuitar={onQuitarPdf}
      />
      <ArchivoChip
        titulo="XML del CFDI"
        ayuda="pendiente · obligatorio en proveedores mexicanos"
        archivo={xml}
        icono={FileCode2}
        onQuitar={onQuitarXml}
      />
    </div>
  );
}
