/**
 * Lógica de guardado de `NuevaOportunidadDialog`: crea/actualiza la
 * oportunidad y, al crear, la tarea automática de seguimiento.
 * Extraído del componente para mantenerlo ≤200 LOC.
 */
import { useRef, useState } from "react";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import {
  useCrearOportunidad,
  useActualizarOportunidad,
  useCrearActividad,
  type CrmOportunidadRow,
} from "@/features/crm/hooks";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";
import { mxLocalToUtcIso } from "@/lib/date/mx";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";
import {
  buildOportunidadFormPayload,
  validarOportunidadForm,
} from "@/features/crm/domain/oportunidadFormPayload";

interface Args {
  form: OportunidadFormState;
  esGanada: boolean;
  isEdit: boolean;
  oportunidad?: CrmOportunidadRow | null;
  autoActividad: boolean;
  markClean: () => void;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}

export function useNuevaOportunidadSubmit({
  form, esGanada, isEdit, oportunidad, autoActividad, markClean, onOpenChange, onSaved,
}: Args) {
  const crear = useCrearOportunidad();
  const actualizar = useActualizarOportunidad();
  const crearActividad = useCrearActividad();
  const enviandoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);

  // Hallazgo #13.3: si la tarea automática falla, el registro principal ya
  // se creó — el mensaje debe dejarlo claro (no un error genérico que
  // sugiera que todo falló). `silencioso` evita el toast genérico del hook.
  const crearActividadSeguimiento = async (oportunidadId: string) => {
    // Regla centralizada (calendario CDMX + siguiente día hábil), igual que
    // el alta de lead: nunca cae en sábado/domingo ni depende del reloj local.
    const fechaProgramada = mxLocalToUtcIso(actividadDefaultFechaMx());
    try {
      await crearActividad.mutateAsync({
        tipo: "tarea",
        asunto: `Preparar propuesta: ${form.nombre}`,
        descripcion: "Actividad creada automáticamente al alta de la oportunidad.",
        entidad_tipo: "oportunidad",
        entidad_id: oportunidadId,
        fecha_programada: fechaProgramada,
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

  return { handleSubmit, pendingTotal };
}
