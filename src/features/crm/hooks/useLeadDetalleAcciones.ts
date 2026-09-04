/**
 * Acciones de la ficha de lead: guardar, eliminar, calificar como prospecto y
 * tomar de la bolsa común.
 *
 * Extraído de `LeadDetalle.tsx` para respetar el límite de 200 líneas
 * (Power of 10).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { ROUTES } from "@/constants/routes";
import { faltantesGateProspecto } from "@/features/crm/domain/leads/etapas";
import { emailLooksValid } from "@/features/cliente/components/nuevoClienteValidators";
import {
  useActualizarLead,
  useCalificarProspecto,
  useEliminarLead,
  useTomarLead,
} from "@/features/crm/hooks";
import type { LeadEditForm } from "@/types/crm/leadEditForm";

interface LeadMinimo {
  id: string;
  empresa: string;
}

export function useLeadDetalleAcciones(
  id: string | undefined,
  lead: (LeadMinimo & Record<string, unknown>) | undefined,
  /** Sólo los campos editados: guardar Notas no debe pisar el resto. */
  patch: Partial<LeadEditForm>,
) {
  const navigate = useNavigate();
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();
  const tomar = useTomarLead();
  const calificar = useCalificarProspecto();
  const [faltantesGate, setFaltantesGate] = useState<string[]>([]);
  /**
   * v13.823.78: la edición no validaba el correo (el alta sí), así que
   * "foo" se persistía. Correo vacío sigue permitido: puede haber teléfono.
   */
  const [errorEmail, setErrorEmail] = useState<string | null>(null);

  const handleSave = async () => {
    if (!id) return;
    if (Object.keys(patch).length === 0) {
      crmToast.success("No hay cambios por guardar");
      return;
    }
    const email = (patch.email ?? "").trim();
    if (email !== "" && !emailLooksValid(email)) {
      setErrorEmail("Escribe un correo válido, por ejemplo nombre@empresa.com");
      return;
    }
    setErrorEmail(null);
    try {
      await actualizar.mutateAsync({ id, patch });
      crmToast.success("Cambios guardados");
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_SAVE",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await eliminar.mutateAsync(id);
      crmToast.success("Lead eliminado");
      navigate(ROUTES.CRM_LEADS);
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo eliminar",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "HANDLE_DELETE",
      });
    }
  };

  /**
   * Gate Lead → Prospecto: avisamos los faltantes antes de llamar a la RPC
   * para no gastar un viaje al servidor.
   */
  const handleCalificar = () => {
    // Doble clic idempotente: mientras corre la RPC no se reintenta.
    if (!lead || calificar.isPending) return;
    const faltantes = faltantesGateProspecto(lead as Parameters<typeof faltantesGateProspecto>[0]);
    if (faltantes.length > 0) {
      setFaltantesGate(faltantes);
      return;
    }
    setFaltantesGate([]);
    calificar.mutate(lead.id);
  };

  /** Tomar el lead de la bolsa común (asigna vendedor_id = yo). */
  const handleTomar = () => {
    if (!lead) return;
    tomar.mutate({ id: lead.id, empresa: lead.empresa });
  };

  return {
    handleSave,
    handleDelete,
    handleCalificar,
    handleTomar,
    faltantesGate,
    errorEmail,
    cerrarGate: () => setFaltantesGate([]),
    guardando: actualizar.isPending,
    eliminando: eliminar.isPending,
    tomando: tomar.isPending,
    calificando: calificar.isPending,
  };
}
