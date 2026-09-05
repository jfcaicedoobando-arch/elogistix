/**
 * Lógica de guardado de `NuevoLeadDialog`: crea el lead y, si aplica, la
 * actividad automática de primer contacto. Extraído del componente para
 * mantenerlo ≤200 LOC.
 */
import { useRef, useState } from "react";
import { notifyError } from "@/lib/ui/appFeedback";
import { useCrearLead, useCrearActividad } from "@/features/crm/hooks";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";
import { mxLocalToUtcIso } from "@/lib/date/mx";
import { emailLooksValid } from "@/features/cliente/components/nuevoClienteValidators";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { LeadFormState } from "@/features/crm/components/nuevoLead/NuevoLeadForm";

interface Args {
  form: LeadFormState;
  autoActividad: boolean;
  onSaved: (id: string) => void;
  resetForm: () => void;
}

export function useNuevoLeadSubmit({ form, autoActividad, onSaved, resetForm }: Args) {
  const [guardando, setGuardando] = useState(false);
  const crear = useCrearLead();
  const crearActividad = useCrearActividad();
  const enviandoRef = useRef(false);

  const emailInvalido = form.email.trim() !== "" && !emailLooksValid(form.email);
  const pendingTotal = guardando || crear.isPending || crearActividad.isPending;

  const handleSubmit = async () => {
    if (crear.isPending || crearActividad.isPending || enviandoRef.current || guardando) return;
    if (!form.empresa.trim()) {
      notifyError(undefined, { title: "Empresa es obligatoria", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    if (emailInvalido) {
      notifyError(undefined, {
        title: "Correo inválido",
        description: "Escribe un correo con la forma usuario@dominio.com o déjalo vacío.",
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
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

  return { handleSubmit, pendingTotal, emailInvalido };
}
