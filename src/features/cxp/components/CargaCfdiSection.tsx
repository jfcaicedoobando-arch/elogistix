/**
 * Sección de carga de XML CFDI para el modal de captura de factura.
 * - Toggle Manual / Cargar XML.
 * - Drop zone para XML (obligatorio) + adjunto opcional de PDF.
 * - Al procesar: llama edge function parse-cfdi-xml y entrega el resultado
 *   al padre (que prellena el formulario y, si hace falta, ofrece crear
 *   un proveedor nuevo con los datos del XML).
 */
import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseCfdiXml, type CfdiParsedResponse } from "@/features/cxp/services";
import { CfdiUploadError } from "@/features/cxp/services/parseCfdi";
import { toast } from "sonner";

import { notifyError } from "@/components/shared/utils/appFeedback";
export type CargaMode = "manual" | "cfdi";

interface Props {
  mode: CargaMode;
  onModeChange: (m: CargaMode) => void;
  categorias: { id: string; nombre: string }[];
  onParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => void;
  cfdiReady: boolean;
}

export function CargaCfdiSection({ mode, onModeChange, categorias, onParsed, cfdiReady }: Props) {
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setXml(null); setPdf(null);
  }, []);

  const handleXml = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xml")) {
      notifyError(toast, { title: "El archivo debe ser .xml", method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_1" });
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      notifyError(toast, { title: "XML excede 2 MB", method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_2" });
      return;
    }
    setXml(f);
  };

  const procesar = async () => {
    if (!xml) return;
    setLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("CLIENT_TIMEOUT")), 15000);
      });
      const data = await Promise.race([
        parseCfdiXml(xml, categorias),
        timeoutPromise,
      ]);
      onParsed(data, { xml, pdf });
      toast.success("CFDI procesado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error procesando XML";
      const baseCtx = {
        xmlName: xml.name,
        xmlSize: xml.size,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      };
      const richCtx = e instanceof CfdiUploadError ? { ...baseCtx, ...e.context } : baseCtx;
      if (msg === "CLIENT_TIMEOUT") {
        notifyError(toast, {
          title: "Tiempo de espera agotado al procesar el XML. Inténtalo de nuevo o usa Captura manual.",
          error: e,
          context: richCtx,
          method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_3",
        });
      } else {
        notifyError(toast, {
          title: msg,
          error: e,
          context: richCtx,
          method: "FEATURES_CXP_COMPONENTS_CARGACFDISECTION_4",
        });
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

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

          {/* Dropzone XML */}
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

          {/* PDF opcional */}
          <div className="flex items-center gap-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => pdfInputRef.current?.click()}
            >
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
