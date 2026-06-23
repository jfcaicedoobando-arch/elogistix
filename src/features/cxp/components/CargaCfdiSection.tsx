/**
 * Sección de carga de XML CFDI para el modal de captura de factura.
 * - Toggle Manual / Cargar XML.
 * - Drop zone para XML (obligatorio) + adjunto opcional de PDF.
 * - La lógica de subida/red/toast vive en `useCargaCfdi`; aquí sólo
 *   presentación.
 */
import { useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CfdiParsedResponse } from "@/features/cxp/services";
import { useCargaCfdi } from "@/features/cxp/hooks/useCargaCfdi";

export type CargaMode = "manual" | "cfdi";

interface Props {
  mode: CargaMode;
  onModeChange: (m: CargaMode) => void;
  categorias: { id: string; nombre: string }[];
  onParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => void;
  cfdiReady: boolean;
}

export function CargaCfdiSection({ mode, onModeChange, categorias, onParsed, cfdiReady }: Props) {
  const { xml, pdf, loading, setXml, setPdf, reset, handleXml, procesar } = useCargaCfdi({
    categorias,
    onParsed,
  });
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => onModeChange("manual")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
            mode === "manual" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Captura manual
        </button>
        <button
          type="button"
          onClick={() => onModeChange("cfdi")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l",
            mode === "cfdi" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Cargar XML CFDI <Badge variant="secondary" className="ml-1 text-[10px]">México</Badge>
        </button>
      </div>

      {mode === "cfdi" && (
        <div className="p-4 space-y-3">
          {cfdiReady && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              CFDI cargado. Los campos del formulario fueron prellenados — puedes editarlos.
            </div>
          )}

          <div
            onClick={() => xmlInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              handleXml(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "rounded-md border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors",
              xml ? "border-primary/40 bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
            )}
          >
            <input
              ref={xmlInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => handleXml(e.target.files?.[0] ?? null)}
            />
            {xml ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{xml.name}</span>
                <span className="text-muted-foreground">({(xml.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setXml(null); }}
                  className="ml-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                <Upload className="h-5 w-5" />
                <span>Arrastra el <strong>XML del CFDI</strong> o haz clic para seleccionar</span>
                <span className="text-xs">Máximo 2 MB · CFDI 4.0</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => pdfInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-1.5" />
              {pdf ? `PDF: ${pdf.name}` : "Adjuntar PDF (opcional)"}
            </Button>
            {pdf && (
              <button
                type="button"
                onClick={() => setPdf(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {(xml || pdf) && (
              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={loading}>
                Limpiar
              </Button>
            )}
            <Button type="button" size="sm" onClick={procesar} disabled={!xml || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {loading ? "Procesando…" : "Procesar XML"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
