/**
 * Sección de carga de PDF por IA para facturas de proveedores internacionales.
 * Espejo de `CargaCfdiSection` con dropzone PDF + botón "Procesar con IA".
 */
import { useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CfdiParsedResponse } from "@/features/cxp/services";
import { useCargaPdfIa } from "@/features/cxp/hooks/useCargaPdfIa";

interface Props {
  categorias: { id: string; nombre: string }[];
  onParsed: (data: CfdiParsedResponse, files: { pdf: File }) => void;
  pdfReady: boolean;
}

export function CargaPdfIaSection({ categorias, onParsed, pdfReady }: Props) {
  const { pdf, loading, setPdf, reset, handlePdf, procesar } = useCargaPdfIa({ categorias, onParsed });
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <span>
          Sube el PDF de la factura del proveedor extranjero. La IA extraerá folio, fechas,
          moneda, subtotales y conceptos. <strong>Siempre revisa los campos antes de guardar.</strong>
        </span>
      </div>

      {pdfReady && (
        <div className="flex items-center gap-2 rounded-md bg-success/10 border border-success/30 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          PDF procesado. Los campos del formulario fueron prellenados — revísalos y edítalos si es necesario.
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handlePdf(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "rounded-md border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors",
          pdf ? "border-primary/40 bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handlePdf(e.target.files?.[0] ?? null)}
        />
        {pdf ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium">{pdf.name}</span>
            <span className="text-muted-foreground">({(pdf.size / 1024).toFixed(1)} KB)</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPdf(null); }}
              className="ml-2 text-muted-foreground hover:text-foreground"
              aria-label="Quitar PDF"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <Upload className="h-5 w-5" />
            <span>Arrastra el <strong>PDF de la factura</strong> o haz clic para seleccionar</span>
            <span className="text-xs">Máximo 10 MB · La IA soporta inglés, chino, español y otros idiomas</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {pdf && (
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={loading}>
            Limpiar
          </Button>
        )}
        <Button type="button" size="sm" onClick={procesar} disabled={!pdf || loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          {loading ? "Procesando con IA…" : "Procesar con IA"}
        </Button>
      </div>
    </div>
  );
}
