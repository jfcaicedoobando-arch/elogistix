/**
 * Lógica de guardado de `NuevoLeadDialog`: crea el lead y, si aplica, la
 * actividad automática de primer contacto. Extraído del componente para
 * mantenerlo ≤200 LOC.
 */
import { useRef, useState } from "react";
import { notifyError } from "@/lib/ui/appFeedback";
import { enfocarPrimerInvalido } from "@/lib/ui/enfocarPrimerInvalido";
import { useCrearLead, useCrearActividad } from "@/features/crm/hooks";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";
import { mxLocalToUtcIso } from "@/lib/date/mx";
import { emailLooksValid } from "@/features/cliente/components/nuevoClienteValidators";
import type { LeadFormState } from "@/features/crm/components/nuevoLead/NuevoLeadForm";

interface Args {
  form: LeadFormState;
  autoActividad: boolean;
  onSaved: (id: string) => void;
  resetForm: () => void;
}

export function useNuevoLeadSubmit({ form, autoActividad, onSaved, resetForm }: Args) {
  const [guardando, setGuardando] = useState(false);
  // VIS-20260908-04: la omisión de "Empresa" sólo salía como toast temporal con
  // "Ver detalles" (diálogo técnico) mientras el campo quedaba fuera de vista.
  // Ahora se marca el intento y el error se muestra junto al campo.
  const [intentado, setIntentado] = useState(false);
  const crear = useCrearLead();
  const crearActividad = useCrearActividad();
  const enviandoRef = useRef(false);

  const emailInvalido = form.email.trim() !== "" && !emailLooksValid(form.email);
  const pendingTotal = guardando || crear.isPending || crearActividad.isPending;

  const handleSubmit = async () => {
    if (crear.isPending || crearActividad.isPending || enviandoRef.current || guardando) return;
    setIntentado(true);
    if (!form.empresa.trim()) {
      enfocarPrimerInvalido("nuevo-lead-empresa");
      return;
    }
    if (emailInvalido) {
      enfocarPrimerInvalido("nuevo-lead-email");
      return;
    }
    enviandoRef.current = true;
    setGuardando(true);
    try {
      const r = await crear.mutateAsync(form);
      if (autoActividad) {
        // Hallazgo #13.3: el lead ya se creó; si falla la tarea automática el
        // aviso debe decirlo explícitamente. `silencioso` evita el toast doble.
        try {
          await crearActividad.mutateAsync({
            tipo: "llamada",
            asunto: `Primer contacto: ${form.empresa}`,
            descripcion: "Actividad creada automáticamente al alta del lead.",
            entidad_tipo: "lead",
            entidad_id: r.id,
            fecha_programada: mxLocalToUtcIso(actividadDefaultFechaMx()),
            responsable_id: form.vendedor_id ?? null,
            responsable_email: form.vendedor_email ?? "",
            silencioso: true,
          });
        } catch (e) {
          notifyError(undefined, {
            title: "Registro creado, pero no se pudo crear la tarea automática de seguimiento",
            description: e instanceof Error ? e.message : undefined,
            error: e,
            method: "CREAR_ACTIVIDAD_SEGUIMIENTO_LEAD",
          });
        }
      }
      resetForm();
      onSaved(r.id);
    } catch {
      // El feedback de error ya lo muestra `useCrearLead` (onError): notificar
      // aquí también duplicaba el toast para una sola acción. El aviso
      // específico de la actividad automática (arriba) se conserva porque esa
      // mutación va con `silencioso`.
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  };

  const empresaError = intentado && !form.empresa.trim()
    ? "Indica la empresa para continuar."
    : undefined;

  return { handleSubmit, pendingTotal, emailInvalido, empresaError };
}
