import { useState, useEffect } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { AlertCircle, Loader2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import { USOS_CFDI_SAT } from "@/constants/catalogosSAT";
import { CsfDropZone } from "@/features/cliente/components/NuevoClienteFormPieces";
import { parseCsf } from "@/features/cliente/services/csf";
import { notifyError } from "@/lib/ui/appFeedback";
import { CondicionesCreditoSection } from "./CondicionesCreditoSection";

interface ClienteData {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
  regimen_fiscal: string;
  uso_cfdi_default: string;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteData;
  onSave: (data: ClienteData) => Promise<void>;
  isSaving: boolean;
}

type FieldKey = keyof Pick<
  ClienteData,
  "nombre" | "rfc" | "direccion" | "ciudad" | "estado" | "cp" | "contacto" | "email" | "telefono"
>;

function TextField({
  label, field, form, setForm, full, required,
}: { label: string; field: FieldKey; form: ClienteData; setForm: (f: (p: ClienteData) => ClienteData) => void; full?: boolean; required?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <Label className="text-xs">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        value={form[field]}
        onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
        className="mt-1"
      />
    </div>
  );
}

export default function DialogEditarCliente({ open, onOpenChange, cliente, onSave, isSaving }: Props) {
  const [form, setForm] = useState<ClienteData>(cliente);
  const [csfFileName, setCsfFileName] = useState<string | null>(null);
  const [parsingCsf, setParsingCsf] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(cliente);
      setCsfFileName(null);
      setParsingCsf(false);
    }
  }, [open, cliente]);

  const handleCsfFile = async (file: File | null) => {
    if (!file) return;
    setParsingCsf(true);
    setCsfFileName(file.name);
    try {
      const data = await parseCsf(file);
      setForm((prev) => ({
        ...prev,
        nombre: data.nombre?.trim() || prev.nombre,
        rfc: data.rfc?.trim() || prev.rfc,
        cp: data.cp?.trim() || prev.cp,
        direccion: data.direccion?.trim() || prev.direccion,
        ciudad: data.ciudad?.trim() || prev.ciudad,
        estado: data.estado?.trim() || prev.estado,
        regimen_fiscal: data.regimen_fiscal?.trim() || prev.regimen_fiscal,
      }));
      notifySuccess(undefined, { title: "CSF procesada. Verifica los datos actualizados antes de guardar." });
    } catch (err) {
      setCsfFileName(null);
      const mensaje = err instanceof Error ? err.message : "No se pudo procesar la CSF";
      notifyError(undefined, { title: mensaje, error: err, method: "DIALOG_EDITAR_CLIENTE_CSF" });
    } finally {
      setParsingCsf(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.regimen_fiscal.trim()) return;
    await onSave(form);
  };

  const faltanDatosCfdi = !form.regimen_fiscal.trim() || !form.uso_cfdi_default.trim();

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserCog}
      title="Editar Cliente"
      description="Modifica los datos generales y fiscales del cliente."
      size="lg"
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.nombre.trim() || !form.regimen_fiscal.trim() || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      )}
    >
      {faltanDatosCfdi && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Faltan datos fiscales para CFDI 4.0 (régimen fiscal y/o uso CFDI). Sin estos datos no se podrá timbrar facturas a este cliente.
          </AlertDescription>
        </Alert>
      )}

      <FormDialogSection
        title="Actualizar desde CSF (opcional)"
        description="Sube el PDF de la Constancia de Situación Fiscal para rellenar automáticamente los campos. Podrás ajustarlos antes de guardar."
      >
        <div className="md:col-span-2">
          <CsfDropZone parsingCsf={parsingCsf} fileName={csfFileName} onFile={handleCsfFile} />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Datos fiscales" description="Información requerida para facturación SAT.">

        <TextField label="RFC" field="rfc" form={form} setForm={setForm} />
        <TextField label="Código Postal" field="cp" form={form} setForm={setForm} />
        <div>
          <Label className="text-xs">Régimen Fiscal SAT<span className="text-destructive ml-0.5">*</span></Label>
          <Select value={form.regimen_fiscal || undefined} onValueChange={(v) => setForm((p) => ({ ...p, regimen_fiscal: v }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
            <SelectContent>
              {REGIMENES_FISCALES_SAT.map((r) => (
                <SelectItem key={r.clave} value={r.clave}>{r.clave} — {r.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Uso CFDI por defecto</Label>
          <Select value={form.uso_cfdi_default || undefined} onValueChange={(v) => setForm((p) => ({ ...p, uso_cfdi_default: v }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona uso CFDI" /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Datos generales y contacto">
        <TextField full label="Nombre / Razón Social" field="nombre" form={form} setForm={setForm} required />
        <TextField full label="Dirección" field="direccion" form={form} setForm={setForm} />
        <TextField label="Ciudad" field="ciudad" form={form} setForm={setForm} />
        <TextField label="Estado" field="estado" form={form} setForm={setForm} />
        <TextField label="Contacto" field="contacto" form={form} setForm={setForm} />
        <TextField label="Email" field="email" form={form} setForm={setForm} />
        <TextField label="Teléfono" field="telefono" form={form} setForm={setForm} />
      </FormDialogSection>

      <CondicionesCreditoSection form={form} setForm={setForm} />
    </FormDialogShell>
  );
}
