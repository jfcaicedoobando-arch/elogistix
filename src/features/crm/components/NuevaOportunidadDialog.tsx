/**
 * Diálogo para crear / editar una Oportunidad CRM.
 * Form fields en `nuevaOportunidad/OportunidadFormFields`; estado en `useOportunidadForm`.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useState } from "react";
import { Loader2, Briefcase } from "lucide-react";
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
import { useOportunidadForm } from "@/features/crm/hooks";
import OportunidadFormFields from "@/features/crm/components/nuevaOportunidad/OportunidadFormFields";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidad?: CrmOportunidadRow | null;
  onSaved?: (id: string) => void;
}

export default function NuevaOportunidadDialog({ open, onOpenChange, oportunidad, onSaved }: Props) {
  const isEdit = !!oportunidad;
  const { user } = useAuth();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const crear = useCrearOportunidad();
  const actualizar = useActualizarOportunidad();
  const crearActividad = useCrearActividad();

  const { form, setForm, set } = useOportunidadForm(open, oportunidad, etapas, user);
  const [autoActividad, setAutoActividad] = useState(true);

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return notifyError(undefined, { title: "Nombre es obligatorio", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
    if (!form.etapa_id) return notifyError(undefined, { title: "Selecciona una etapa", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
    // B-034: etapa "ganada" exige fecha de cierre real; valor real por
    // defecto = monto estimado (editable en el form).
    const etapaSel = etapas.find((e) => e.id === form.etapa_id);
    const esGanada = (etapaSel as { tipo?: string } | undefined)?.tipo === "ganada";
    if (esGanada && !form.fecha_cierre_real) {
      return notifyError(undefined, {
        title: "Captura la fecha de cierre real",
        description: "Una oportunidad ganada necesita su fecha de cierre para que el Resumen y el Leaderboard coincidan.",
        method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
    try {
      const payload = {
        nombre: form.nombre,
        cliente_id: form.cliente_id,
        cliente_nombre: form.cliente_nombre,
        etapa_id: form.etapa_id,
        monto_estimado: form.monto_estimado,
        moneda: form.moneda,
        probabilidad: form.probabilidad,
        fecha_estimada_cierre: form.fecha_estimada_cierre || null,
        // B-034: solo se persisten cuando la etapa destino es "ganada".
        ...(esGanada ? {
          fecha_cierre_real: form.fecha_cierre_real,
          valor_real: form.valor_real > 0 ? form.valor_real : form.monto_estimado,
        } : {}),
        modo: form.modo,
        origen: form.origen,
        destino: form.destino,
        notas: form.notas,
        vendedor_id: form.vendedor_id,
        vendedor_email: form.vendedor_email,
      };
      if (isEdit && oportunidad) {
        await actualizar.mutateAsync({ id: oportunidad.id, patch: payload });
        crmToast.success("Oportunidad actualizada");
        onSaved?.(oportunidad.id);
      } else {
        const r = await crear.mutateAsync(payload);
        if (autoActividad) {
          const manana = new Date();
          manana.setDate(manana.getDate() + 1);
          manana.setHours(9, 0, 0, 0);
          await crearActividad.mutateAsync({
            tipo: "tarea",
            asunto: `Preparar propuesta: ${form.nombre}`,
            descripcion: "Actividad creada automáticamente al alta de la oportunidad.",
            entidad_tipo: "oportunidad",
            entidad_id: r.id,
            fecha_programada: manana.toISOString(),
          }).catch(() => undefined);
        }
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
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={handleSubmit} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
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
