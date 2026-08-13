/**
 * Ola 4 — Modal compartido para agregar un documento al expediente
 * (cliente o proveedor). Usa el shell estándar de modales tipo formulario.
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
import { validarVigencia } from "@/features/expediente/domain/expediente";

export interface DocumentoFormValues {
  tipo: string;
  archivo: File;
  fechaDocumento: string | null;
  fechaVencimiento: string | null;
  notas: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Catálogo de tipos permitidos para esta entidad. */
  tipos: readonly string[];
  /** Tipos cuya fecha de vigencia es obligatoria. */
  tiposConVencimiento: readonly string[];
  tipoSugerido?: string;
  descripcion: string;
  isPending: boolean;
  onGuardar: (valores: DocumentoFormValues) => void;
}

const FORM_ID = "form-subir-doc-expediente";
const MAX_MB = 15;

export function SubirDocumentoDialog({
  open, onOpenChange, tipos, tiposConVencimiento, tipoSugerido,
  descripcion, isPending, onGuardar,
}: Props) {
  const [tipo, setTipo] = useState<string>(tipoSugerido ?? tipos[0]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    const errorVigencia = validarVigencia(
      tipo, fechaDocumento || null, fechaVencimiento || null, tiposConVencimiento,
    );
    if (errorVigencia) { setError(errorVigencia); return; }
    setError(null);
    onGuardar({
      tipo,
      archivo,
      fechaDocumento: fechaDocumento || null,
      fechaVencimiento: fechaVencimiento || null,
      notas,
    });
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={cerrar}
      icon={FileUp}
      title="Agregar documento al expediente"
      description={descripcion}
      size="md"
      formId={FORM_ID}
      onSubmit={onSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={isPending}>
            Guardar documento
          </Button>
        </>
      }
    >
      <FormDialogSection title="Documento">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-tipo">Tipo de documento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="doc-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
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

      <FormDialogSection
        title="Vigencia"
        description="Las opiniones de cumplimiento y las cartas bancarias caducan; captura su vigencia para recibir avisos."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-fecha">Fecha del documento</Label>
            <DatePickerMx id="doc-fecha" value={fechaDocumento}
              onChange={setFechaDocumento} max={fechaVencimiento || undefined}
              aria-label="Fecha del documento" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-vence">
              Vigente hasta {tiposConVencimiento.includes(tipo) ? "(obligatoria)" : "(opcional)"}
            </Label>
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
