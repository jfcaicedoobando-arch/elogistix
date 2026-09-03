/**
 * Diálogo para crear / editar una Oportunidad CRM.
 * Form fields en `nuevaOportunidad/OportunidadFormFields`; estado en `useOportunidadForm`.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useRef, useState } from "react";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useCrearOportunidad,
  useActualizarOportunidad,
  type CrmOportunidadRow,
} from "@/features/crm/hooks";
import { useEtapasPipeline } from "@/features/crm/hooks";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { useCrearActividad } from "@/features/crm/hooks";
import { useOportunidadForm, type OrigenInicial } from "@/features/crm/hooks";
import OportunidadFormFields from "@/features/crm/components/nuevaOportunidad/OportunidadFormFields";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import {
  buildOportunidadFormPayload,
  validarOportunidadForm,
} from "@/features/crm/domain/oportunidadFormPayload";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidad?: CrmOportunidadRow | null;
  onSaved?: (id: string) => void;
  /** Fase 2 rediseño CRM: prefija el origen (prospecto o cliente). */
  origenInicial?: OrigenInicial | null;
}

export default function NuevaOportunidadDialog({ open, onOpenChange, oportunidad, onSaved, origenInicial }: Props) {
  const isEdit = !!oportunidad;
  const { user } = useAuth();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const crear = useCrearOportunidad();
  const actualizar = useActualizarOportunidad();
  const crearActividad = useCrearActividad();
  const enviandoRef = useRef(false);

  const { form, setForm, set } = useOportunidadForm(open, oportunidad, etapas, user, origenInicial);
  const [autoActividad, setAutoActividad] = useState(true);
  const [guardando, setGuardando] = useState(false);


  const etapaSel = etapas.find((e) => e.id === form.etapa_id);
  const esGanada = (etapaSel as { tipo?: string } | undefined)?.tipo === "ganada";

  const crearActividadSeguimiento = async (oportunidadId: string) => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(9, 0, 0, 0);
    await crearActividad
      .mutateAsync({
        tipo: "tarea",
        asunto: `Preparar propuesta: ${form.nombre}`,
        descripcion: "Actividad creada automáticamente al alta de la oportunidad.",
        entidad_tipo: "oportunidad",
        entidad_id: oportunidadId,
        fecha_programada: manana.toISOString(),
        // Ownership: la actividad automática queda a nombre del vendedor
        // final elegido en el formulario, no del usuario que captura.
        responsable_id: form.vendedor_id ?? null,
        responsable_email: form.vendedor_email ?? "",
      })
      .catch(() => undefined);
  };

  const pending = crear.isPending || actualizar.isPending;

  const handleSubmit = async () => {
    if (pending || enviandoRef.current) return;
    const invalido = validarOportunidadForm(form, esGanada);
    if (invalido) {
      return notifyError(undefined, {
        ...invalido,
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
    enviandoRef.current = true;
    try {
      const payload = buildOportunidadFormPayload(form, esGanada, isEdit);
      if (isEdit && oportunidad) {
        await actualizar.mutateAsync({ id: oportunidad.id, patch: payload });
        crmToast.success("Oportunidad actualizada");
        onSaved?.(oportunidad.id);
      } else {
        const r = await crear.mutateAsync(payload);
        if (autoActividad) await crearActividadSeguimiento(r.id);
        crmToast.success("Oportunidad creada");
        onSaved?.(r.id);
      }
      onOpenChange(false);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_SUBMIT",
      });
    } finally {
      enviandoRef.current = false;
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
      <Button onClick={handleSubmit} loading={pending} disabled={!isEdit && !form.etapa_id}>
        {isEdit ? "Guardar cambios" : "Crear oportunidad"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Briefcase}
      title={isEdit ? "Editar oportunidad" : "Nueva oportunidad"}
      description="Captura los datos comerciales y la etapa del pipeline."
      size="2xl"
      busy={pending}
      footer={footer}
    >
      <OportunidadFormFields
        form={form}
        setForm={setForm}
        set={set}
        etapas={etapas}
        clientes={clientes}
        isEdit={isEdit}
        autoActividad={autoActividad}
        setAutoActividad={setAutoActividad}
      />
    </FormDialogShell>
  );
}
