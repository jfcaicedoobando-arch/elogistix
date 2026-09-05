/**
 * Diálogo para crear / editar una Oportunidad CRM.
 * Form fields en `nuevaOportunidad/OportunidadFormFields`; estado en `useOportunidadForm`.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useEffect, useRef, useState } from "react";
import { Briefcase } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
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
  faltantesOportunidadForm,
} from "@/features/crm/domain/oportunidadFormPayload";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidad?: CrmOportunidadRow | null;
  onSaved?: (id: string) => void;
  /** Fase 2 rediseño CRM: prefija el origen (prospecto o cliente). */
  origenInicial?: OrigenInicial | null;
  /** Nombre precapturado en el alta express al pulsar "Más campos". */
  nombreInicial?: string | null;
  /** Etapa prefijada por el CTA de una columna del Kanban (sólo si abierta). */
  etapaInicialId?: string | null;
}

export default function NuevaOportunidadDialog({
  open,
  onOpenChange,
  oportunidad,
  onSaved,
  origenInicial,
  nombreInicial,
  etapaInicialId,
}: Props) {
  const isEdit = !!oportunidad;
  const { user } = useAuth();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const crear = useCrearOportunidad();
  const actualizar = useActualizarOportunidad();
  const crearActividad = useCrearActividad();
  const enviandoRef = useRef(false);

  const { form, setForm, set, isDirty, markClean } = useOportunidadForm(
    open,
    oportunidad,
    etapas,
    user,
    { origen: origenInicial, nombre: nombreInicial, etapaId: etapaInicialId },
  );
  const [autoActividad, setAutoActividad] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Al cerrar de verdad una creación, la casilla de actividad automática
  // vuelve a su valor por omisión para la siguiente apertura. En edición no
  // aplica (la casilla no se muestra).
  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (abiertoAntes.current && !open && !isEdit) setAutoActividad(true);
    abiertoAntes.current = open;
  }, [open, isEdit]);

  const etapaSel = etapas.find((e) => e.id === form.etapa_id);
  const esGanada = (etapaSel as { tipo?: string } | undefined)?.tipo === "ganada";

  // Hallazgo #13.3: si la tarea automática falla, el registro principal ya
  // se creó — el mensaje debe dejarlo claro (no un error genérico que
  // sugiera que todo falló). `silencioso` evita el toast genérico del hook.
  const crearActividadSeguimiento = async (oportunidadId: string) => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(9, 0, 0, 0);
    try {
      await crearActividad.mutateAsync({
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
        silencioso: true,
      });
    } catch (e) {
      notifyError(undefined, {
        title: "Registro creado, pero no se pudo crear la tarea automática de seguimiento",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "CREAR_ACTIVIDAD_SEGUIMIENTO_OPORTUNIDAD",
      });
    }
  };

  const pendingTotal = guardando || crear.isPending || actualizar.isPending || crearActividad.isPending;

  const handleSubmit = async () => {
    if (pendingTotal || enviandoRef.current) return;
    const invalido = validarOportunidadForm(form, esGanada);
    if (invalido) {
      return notifyError(undefined, {
        ...invalido,
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
    enviandoRef.current = true;
    setGuardando(true);
    try {
      const payload = buildOportunidadFormPayload(form, esGanada, isEdit);
      if (isEdit && oportunidad) {
        // Hallazgo 14: bloqueo optimista — el sello se leyó al abrir el diálogo.
        await actualizar.mutateAsync({ id: oportunidad.id, patch: payload, expectedUpdatedAt: oportunidad.updated_at ?? null });
        crmToast.success("Oportunidad actualizada");
        onSaved?.(oportunidad.id);
      } else {
        const r = await crear.mutateAsync(payload);
        if (autoActividad) await crearActividadSeguimiento(r.id);
        onSaved?.(r.id);
      }
      markClean();
      onOpenChange(false);
    } catch {
      // Los hooks de crear/actualizar ya notificaron el error: un solo aviso.
      void 0;
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  };
  // Sucio total: el formulario más la casilla de actividad automática (sólo
  // relevante al crear). Habilita la confirmación de descarte del shell.
  const dirtyTotal = isDirty || (!isEdit && autoActividad !== true);

  // Candado explícito al crear: sin origen, nombre o etapa el botón no debe
  // parecer accionable (antes el clic era un no-op silencioso).
  const faltantes = isEdit ? [] : faltantesOportunidadForm(form);

  const footer = (
    <FormDialogFooter
      onCancel={() => onOpenChange(false)}
      onConfirm={handleSubmit}
      confirmLabel={isEdit ? "Guardar cambios" : "Crear oportunidad"}
      loading={pendingTotal}
      disabled={faltantes.length > 0}
    />
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Briefcase}
      title={isEdit ? "Editar oportunidad" : "Nueva oportunidad"}
      description="Captura los datos comerciales y la etapa del pipeline."
      size="2xl"
      isDirty={dirtyTotal}
      busy={pendingTotal}
      footer={footer}
    >
      {faltantes.length > 0 && (
        <p
          role="status"
          aria-live="polite"
          className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive"
        >
          Para crear la oportunidad falta: {faltantes.join(", ")}.
        </p>
      )}
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
