/**
 * Ola 3 — Modal para agregar un documento al expediente del proveedor.
 * Usa el shell estándar de modales tipo formulario.
 */
import { useState } from "react";
import { FileUp } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TIPOS_DOCUMENTO_PROVEEDOR,
  type TipoDocumentoProveedor,
} from "@/features/proveedor/domain/documentosProveedor";
import { useSubirDocumentoProveedor } from "@/features/proveedor/hooks/useProveedorDocumentos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorId: string;
  organizationId: string;
  tipoSugerido?: TipoDocumentoProveedor;
}

const FORM_ID = "form-subir-doc-proveedor";
const MAX_MB = 15;

export function SubirDocumentoProveedorDialog({
  open, onOpenChange, proveedorId, organizationId, tipoSugerido,
}: Props) {
  const [tipo, setTipo] = useState<TipoDocumentoProveedor>(
    tipoSugerido ?? "Constancia de situación fiscal",
  );
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const subir = useSubirDocumentoProveedor(proveedorId);

  const cerrar = (v: boolean) => {
    if (!v) {
      setArchivo(null); setFechaDocumento(""); setFechaVencimiento("");
      setNotas(""); setError(null);
    }
    onOpenChange(v);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!archivo) { setError("Selecciona un archivo (PDF, XML o imagen)."); return; }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera los ${MAX_MB} MB permitidos.`); return;
    }
    setError(null);
    subir.mutate(
      {
        proveedorId, organizationId, tipo, archivo,
        fechaDocumento: fechaDocumento || null,
        fechaVencimiento: fechaVencimiento || null,
        notas,
      },
      { onSuccess: () => cerrar(false) },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={cerrar}
      icon={FileUp}
      title="Agregar documento al expediente"
      description="Guarda constancias, opiniones de cumplimiento, contratos y comprobantes bancarios del proveedor."
      size="md"
      formId={FORM_ID}
      onSubmit={onSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={subir.isPending}>
            Guardar documento
          </Button>
        </>
      }
    >
      <FormDialogSection title="Documento">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-tipo">Tipo de documento</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumentoProveedor)}>
              <SelectTrigger id="doc-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO_PROVEEDOR.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-archivo">Archivo</Label>
            <Input
              id="doc-archivo"
              type="file"
              accept=".pdf,.xml,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <p className="text-2xs text-muted-foreground">
              PDF, XML o imagen, hasta {MAX_MB} MB.
            </p>
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Vigencia" description="La opinión de cumplimiento y las cartas bancarias caducan; captura su vigencia para recibir avisos.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-fecha">Fecha del documento</Label>
            <DatePickerMx id="doc-fecha" value={fechaDocumento}
              onChange={setFechaDocumento} max={fechaVencimiento || undefined}
              aria-label="Fecha del documento" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-vence">Vigente hasta (opcional)</Label>
            <DatePickerMx id="doc-vence" value={fechaVencimiento}
              onChange={setFechaVencimiento} min={fechaDocumento || undefined}
              aria-label="Vigente hasta" />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Notas">
        <div className="space-y-2">
          <Label htmlFor="doc-notas">Notas (opcional)</Label>
          <Textarea id="doc-notas" value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Referencia interna, quién lo envió, etc." rows={3} />
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </FormDialogSection>
    </FormDialogShell>
  );
}
