/**
 * Bloque R — Diálogo para crear/editar una póliza de seguro de carga.
 */
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCreateSeguro, useUpdateSeguro } from "@/features/embarques/hooks/useSegurosEmbarque";
import type { SeguroEmbarque, SeguroEmbarqueInput } from "@/features/embarques/services/seguros";
import { todayLocalISO } from "@/lib/date/today";
import { validarSeguroForm } from "./seguroFormValidation";
import { SeguroFormCamposPrincipales } from "./SeguroFormCamposPrincipales";
import { SeguroFormCamposAdicionales } from "./SeguroFormCamposAdicionales";

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
    if (!validarSeguroForm(form, isEdit)) return;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SeguroFormCamposPrincipales form={form} setField={setField} />
        <SeguroFormCamposAdicionales form={form} setField={setField} />
      </div>
    </FormDialogShell>
  );
}
