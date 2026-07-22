/**
 * Sección de carga de XML CFDI para notas de crédito de proveedor.
 * Reutiliza useCargaCfdi y deja la lógica de parseo en el hook; esta sección
 * solo se encarga de presentar el dropzone y la advertencia de tipo de comprobante.
 */
import { useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CfdiParsedResponse } from "@/features/cxp/services";
import { useCargaCfdi } from "@/features/cxp/hooks/useCargaCfdi";

interface Props {
  parsed: CfdiParsedResponse | null;
  onParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => void;
}

const TIPO_LABEL: Record<string, string> = {
  I: "Ingreso (factura)",
  E: "Egreso (nota de crédito)",
  T: "Traslado",
  N: "Nómina",
  P: "Pago",
};

export function CargaXmlNcSection({ parsed, onParsed }: Props) {
  const { xml, pdf, loading, setPdf, reset, handleXml, procesar } = useCargaCfdi({
    categorias: [],
    onParsed: async (data, files) => {
      onParsed(data, files);
    },
  });
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const tipo = parsed?.cfdi.tipo_comprobante;
  const esNc = tipo === "E";

  return (
    <div className="space-y-3">
      {parsed && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
            esNc
              ? "bg-success/10 border-success/30 text-success"
              : "bg-warning/10 border-warning/30 text-warning",
          )}
        >
          {esNc ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {esNc
            ? "CFDI detectado como nota de crédito. Los campos fueron prellenados."
            : `El CFDI es tipo "${TIPO_LABEL[tipo ?? ""] || tipo}". Verifica que realmente sea una nota de crédito antes de guardar.`}
        </div>
      )}

      <div
        onClick={() => xmlInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
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
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <Upload className="h-5 w-5" />
            <span>Arrastra el <strong>XML de la nota de crédito</strong> o haz clic para seleccionar</span>
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
  );
}
