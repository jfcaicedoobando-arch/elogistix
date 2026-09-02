/**
 * Diálogo para crear un nuevo Lead (CRM Fase 2).
 * Formulario simple — los campos avanzados se editan en LeadDetalle.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useCallback, useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCrearLead } from "@/features/crm/hooks";
import { useCrearActividad } from "@/features/crm/hooks";
import { NuevoLeadForm, type LeadFormState } from "./nuevoLead/NuevoLeadForm";
import { AvisoLeadDuplicado } from "./AvisoLeadDuplicado";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const EMPTY: LeadFormState = {
  empresa: "",
  contacto: "",
  email: "",
  telefono: "",
  ciudad: "",
  pais: "México",
  fuente: "Otro",
  estado: "Nuevo",
  interes_modo: "",
  notas: "",
  vendedor_id: null,
  vendedor_email: "",
};

export default function NuevoLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  // v13.823.50 — al limpiar el formulario se volvía a `EMPTY` (sin vendedor),
  // así que sólo el primer lead de la sesión quedaba asignado al usuario.
  const formVacio = useCallback(
    (): LeadFormState => ({ ...EMPTY, vendedor_id: user?.id ?? null, vendedor_email: user?.email ?? "" }),
    [user?.id, user?.email],
  );
  const [form, setForm] = useState<LeadFormState>(formVacio);
  const [autoActividad, setAutoActividad] = useState(true);
  const crear = useCrearLead();
  const crearActividad = useCrearActividad();

  const handleSubmit = async () => {
    if (!form.empresa.trim()) {
      notifyError(undefined, { title: "Empresa es obligatoria", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    try {
      const r = await crear.mutateAsync(form);
      if (autoActividad) {
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        manana.setHours(9, 0, 0, 0);
        await crearActividad.mutateAsync({
          tipo: "llamada",
          asunto: `Primer contacto: ${form.empresa}`,
          descripcion: "Actividad creada automáticamente al alta del lead.",
          entidad_tipo: "lead",
          entidad_id: r.id,
          fecha_programada: manana.toISOString(),
        }).catch(() => undefined);
      }
      crmToast.success("Lead creado");
      setForm(formVacio());
      onOpenChange(false);
      onCreated?.(r.id);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo crear el lead",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_SUBMIT",
      });
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) setForm(formVacio());
    onOpenChange(o);
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={handleSubmit} loading={crear.isPending}>
        Crear lead
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={Target}
      title="Nuevo lead"
      description="Captura los datos básicos del prospecto. Podrás convertirlo a cliente y oportunidad desde su ficha."
      size="2xl"
      footer={footer}
    >
      <AvisoLeadDuplicado
        empresa={form.empresa}
        email={form.email}
        telefono={form.telefono}
      />
      <NuevoLeadForm
        form={form}
        setForm={setForm}
        autoActividad={autoActividad}
        setAutoActividad={setAutoActividad}
      />
    </FormDialogShell>
  );
}
