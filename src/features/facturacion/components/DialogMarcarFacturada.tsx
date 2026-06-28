import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Loader2, Paperclip, X, FileText, FileCode2, CheckCircle2 } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useMarcarProformaFacturada, type ProformaRow } from "@/features/embarques/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proforma: ProformaRow | null;
}

export function DialogMarcarFacturada({ open, onOpenChange, proforma }: Props) {
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const marcar = useMarcarProformaFacturada();

  useEffect(() => {
    if (open) {
      setFolio("");
      setFecha(new Date().toISOString().slice(0, 10));
      setPdfFile(null);
      setXmlFile(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!proforma || !folio.trim() || !proforma.embarque_id) return;
    try {
      await marcar.mutateAsync({
        proformaId: proforma.id,
        embarqueId: proforma.embarque_id,
        folioFacturaExterna: folio.trim(),
        fechaFacturacion: fecha,
        pdfFile,
        xmlFile,
      });
      onOpenChange(false);
    } catch {
      // toast en hook
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };
  const clearXml = () => {
    setXmlFile(null);
    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={marcar.isPending}>
        Cancelar
      </Button>
      <Button onClick={handleConfirm} disabled={!folio.trim() || marcar.isPending}>
        {marcar.isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
        ) : (
          "Confirmar"
        )}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={CheckCircle2}
      title="Marcar proforma como facturada"
      description={proforma ? `Proforma ${proforma.numero} — Cliente: ${proforma.cliente_nombre}` : undefined}
      size="md"
      footer={footer}
    >
      <div className="space-y-2">
        <Label htmlFor="folio">Folio de factura *</Label>
        <Input
          id="folio"
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
          placeholder="Ej. A-12345"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fecha">Fecha de facturación</Label>
        <DatePickerMx
          value={fecha}
          onChange={setFecha}
          className="w-full"
        />
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" /> Adjuntar factura timbrada (opcional)
        </div>

        {/* PDF */}
        <div className="space-y-1">
          <Label htmlFor="pdf" className="text-xs">Factura PDF</Label>
          {pdfFile ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
              <FileText className="h-4 w-4 text-destructive shrink-0" />
              <span className="truncate flex-1">{pdfFile.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={clearPdf} aria-label="Quitar PDF">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Input
              id="pdf"
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
          )}
        </div>

        {/* XML */}
        <div className="space-y-1">
          <Label htmlFor="xml" className="text-xs">Factura XML</Label>
          {xmlFile ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
              <FileCode2 className="h-4 w-4 text-info shrink-0" />
              <span className="truncate flex-1">{xmlFile.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={clearXml} aria-label="Quitar XML">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Input
              id="xml"
              ref={xmlInputRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
            />
          )}
        </div>
      </div>
    </FormDialogShell>
  );
}
