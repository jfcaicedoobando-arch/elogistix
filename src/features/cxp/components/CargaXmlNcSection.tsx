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

function TipoAlert({ parsed }: { parsed: CfdiParsedResponse | null }) {
  if (!parsed) return null;
  const tipo = parsed.cfdi.tipo_comprobante;
  const esNc = tipo === "E";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        esNc ? "bg-success/10 border-success/30 text-success" : "bg-warning/10 border-warning/30 text-warning",
      )}
    >
      {esNc ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {esNc
        ? "CFDI detectado como nota de crédito. Los campos fueron prellenados."
        : `El CFDI es tipo "${TIPO_LABEL[tipo] || tipo}". Verifica que realmente sea una nota de crédito antes de guardar.`}
    </div>
  );
}

interface XmlDropProps {
  xml: File | null;
  onFile: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

function XmlDrop({ xml, onFile, inputRef }: XmlDropProps) {
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
      className={cn(
        "rounded-md border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors",
        xml ? "border-primary/40 bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {xml ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium">{xml.name}</span>
          <span className="text-muted-foreground">({(xml.size / 1024).toFixed(1)} KB)</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFile(null); }}
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
  );
}

interface PdfPickerProps {
  pdf: File | null;
  onFile: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

function PdfPicker({ pdf, onFile, inputRef }: PdfPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <FileText className="h-4 w-4 mr-1.5" />
        {pdf ? `PDF: ${pdf.name}` : "Adjuntar PDF (opcional)"}
      </Button>
      {pdf && (
        <button
          type="button"
          onClick={() => onFile(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function CargaXmlNcSection({ parsed, onParsed }: Props) {
  const { xml, pdf, loading, setXml, setPdf, reset, handleXml, procesar } = useCargaCfdi({
    categorias: [],
    onParsed: async (data, files) => onParsed(data, files),
  });
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <TipoAlert parsed={parsed} />
      <XmlDrop xml={xml} onFile={handleXml} inputRef={xmlInputRef} />
      <PdfPicker pdf={pdf} onFile={setPdf} inputRef={pdfInputRef} />
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
