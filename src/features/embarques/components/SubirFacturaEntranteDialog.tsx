/**
 * Diálogo para que operaciones suba el PDF/XML de una factura de proveedor
 * al buzón del embarque (modo archivo: no crea la factura contable).
 */
import { useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { validarArchivoEntrante, TAMANO_MAX_ENTRANTE_MB } from "@/lib/domain/facturasEntrantes";
import { useSubirFacturaEntrante } from "@/features/cxp/hooks/useFacturasEntrantes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  organizationId: string;
}

export function SubirFacturaEntranteDialog({ open, onOpenChange, embarqueId, organizationId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subir = useSubirFacturaEntrante();

  const cerrar = () => {
    setFile(null);
    setNota("");
    setError(null);
    onOpenChange(false);
  };

  const onSubmit = async () => {
    if (!file) { setError("Selecciona el archivo de la factura."); return; }
    const invalido = validarArchivoEntrante(file);
    if (invalido) { setError(invalido); return; }
    await subir.mutateAsync({ file, embarqueId, organizationId, nota });
    cerrar();
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => { if (!v) cerrar(); }}
      icon={Inbox}
      title="Subir factura de proveedor al buzón"
      description="El archivo queda en el expediente del embarque. Contabilidad lo capturará como factura de proveedor."
      footer={(
        <>
          <Button variant="outline" onClick={cerrar} disabled={subir.isPending}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={subir.isPending || !file}>
            {subir.isPending ? "Subiendo…" : "Enviar al buzón"}
          </Button>
        </>
      )}
    >
      <FormDialogSection title="Archivo" cols={1}>
        <div className="space-y-2">
          <Label htmlFor="factura-entrante-file">Factura (PDF o XML, máx. {TAMANO_MAX_ENTRANTE_MB} MB)</Label>
          <Input
            id="factura-entrante-file"
            ref={inputRef}
            type="file"
            accept=".pdf,.xml,application/pdf,text/xml"
            onChange={(e) => {
              const seleccionado = e.target.files?.[0] ?? null;
              setFile(seleccionado);
              setError(seleccionado ? validarArchivoEntrante(seleccionado) : null);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="factura-entrante-nota">Nota para contabilidad (opcional)</Label>
          <Textarea
            id="factura-entrante-nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej. Invoice del agente en Shanghái, incluye THC destino."
            rows={3}
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
