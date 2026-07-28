/**
 * Bloque R — Diálogo para crear/editar una póliza de seguro de carga.
 */
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCreateSeguro, useUpdateSeguro } from "@/features/embarques/hooks/useSegurosEmbarque";
import type { MonedaSeguro, SeguroEmbarque, SeguroEmbarqueInput } from "@/features/embarques/services/seguros";
import { notifyError } from "@/lib/ui/appFeedback";
import { todayLocalISO } from "@/lib/date/today";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  seguro?: SeguroEmbarque | null;
}

type FormState = Omit<SeguroEmbarqueInput, "embarque_id">;

const emptyState = (): FormState => ({
  aseguradora: "",
  numero_poliza: "",
  certificado_url: null,
  cobertura_descripcion: null,
  suma_asegurada: 0,
  deducible: 0,
  prima: 0,
  moneda: "MXN",
  vigencia_desde: todayLocalISO(),
  vigencia_hasta: todayLocalISO(),
  contacto: null,
  notas: null,
});

export function DialogSeguroForm({ open, onOpenChange, embarqueId, seguro }: Props) {
  const [form, setForm] = useState<FormState>(emptyState());
  const create = useCreateSeguro(embarqueId);
  const update = useUpdateSeguro(embarqueId);
  const isEdit = Boolean(seguro);
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(
      seguro
        ? {
            aseguradora: seguro.aseguradora,
            numero_poliza: seguro.numero_poliza,
            certificado_url: seguro.certificado_url,
            cobertura_descripcion: seguro.cobertura_descripcion,
            suma_asegurada: seguro.suma_asegurada,
            deducible: seguro.deducible,
            prima: seguro.prima,
            moneda: seguro.moneda,
            vigencia_desde: seguro.vigencia_desde,
            vigencia_hasta: seguro.vigencia_hasta,
            contacto: seguro.contacto,
            notas: seguro.notas,
          }
        : emptyState(),
    );
  }, [open, seguro]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    // B-056: antes estos guardas eran returns silenciosos — el submit "moría"
    // sin toast ni mensaje inline. Ahora cada causa se dice explícitamente.
    if (!form.aseguradora.trim() || !form.numero_poliza.trim()) {
      return notifyError(undefined, {
        title: "Faltan datos de la póliza",
        description: "Aseguradora y número de póliza son obligatorios.",
        method: "SEGURO_FORM_SUBMIT",
      });
    }
    if (form.prima < 0) {
      return notifyError(undefined, {
        title: "Prima inválida",
        description: "La prima no puede ser negativa.",
        method: "SEGURO_FORM_SUBMIT",
      });
    }
    if (form.vigencia_hasta < form.vigencia_desde) {
      return notifyError(undefined, {
        title: "Vigencia inválida",
        description: "La vigencia final no puede ser anterior a la inicial.",
        method: "SEGURO_FORM_SUBMIT",
      });
    }
    if (isEdit && seguro) {
      await update.mutateAsync({ id: seguro.id, patch: form });
    } else {
      await create.mutateAsync({ ...form, embarque_id: embarqueId });
    }
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Shield}
      title={isEdit ? "Editar póliza" : "Nueva póliza de seguro"}
      description="Datos de la aseguradora, vigencia, prima y coberturas para la carga."
      size="2xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={busy}>{isEdit ? "Guardar cambios" : "Registrar póliza"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Aseguradora *</Label>
          <Input value={form.aseguradora} onChange={(e) => setField("aseguradora", e.target.value)} />
        </div>
        <div>
          <Label>Número de póliza *</Label>
          <Input value={form.numero_poliza} onChange={(e) => setField("numero_poliza", e.target.value)} />
        </div>

        <div>
          <Label>Vigencia desde *</Label>
          <DatePickerMx value={form.vigencia_desde} onChange={(v) => setField("vigencia_desde", v)} className="w-full" />
        </div>
        <div>
          <Label>Vigencia hasta *</Label>
          <DatePickerMx value={form.vigencia_hasta} onChange={(v) => setField("vigencia_hasta", v)} className="w-full" />
        </div>

        <div>
          <Label>Moneda</Label>
          <Select value={form.moneda} onValueChange={(v) => setField("moneda", v as MonedaSeguro)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Prima (costo) *</Label>
          <Input type="number" min={0} step={0.01} value={form.prima}
            onChange={(e) => setField("prima", Number(e.target.value))} />
        </div>

        <div>
          <Label>Suma asegurada</Label>
          <Input type="number" min={0} step={0.01} value={form.suma_asegurada}
            onChange={(e) => setField("suma_asegurada", Number(e.target.value))} />
        </div>
        <div>
          <Label>Deducible</Label>
          <Input type="number" min={0} step={0.01} value={form.deducible}
            onChange={(e) => setField("deducible", Number(e.target.value))} />
        </div>

        <div className="col-span-2">
          <Label>Cobertura</Label>
          <Textarea rows={2} value={form.cobertura_descripcion ?? ""}
            onChange={(e) => setField("cobertura_descripcion", e.target.value || null)} />
        </div>

        <div>
          <Label>Certificado (URL)</Label>
          <Input value={form.certificado_url ?? ""}
            onChange={(e) => setField("certificado_url", e.target.value || null)} />
        </div>
        <div>
          <Label>Contacto</Label>
          <Input value={form.contacto ?? ""} onChange={(e) => setField("contacto", e.target.value || null)} />
        </div>

        <div className="col-span-2">
          <Label>Notas</Label>
          <Textarea rows={2} value={form.notas ?? ""}
            onChange={(e) => setField("notas", e.target.value || null)} />
        </div>
      </div>
    </FormDialogShell>
  );
}
