/**
 * Acciones de la ficha de lead: guardar, eliminar, calificar como prospecto y
 * tomar de la bolsa común.
 *
 * Extraído de `LeadDetalle.tsx` para respetar el límite de 200 líneas
 * (Power of 10).
 */
import { useNavigate } from "react-router-dom";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { ROUTES } from "@/constants/routes";
import { faltantesGateProspecto } from "@/features/crm/domain/leads/etapas";
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
  form: LeadEditForm,
) {
  const navigate = useNavigate();
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();
  const tomar = useTomarLead();
  const calificar = useCalificarProspecto();

  const handleSave = async () => {
    if (!id) return;
    try {
      await actualizar.mutateAsync({ id, patch: form });
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
    if (!lead) return;
    const faltantes = faltantesGateProspecto(lead as Parameters<typeof faltantesGateProspecto>[0]);
    if (faltantes.length > 0) {
      notifyError(undefined, {
        title: "Falta completar el perfil comercial",
        description: `Captura en el perfil ICP: ${faltantes.join(", ")}.`,
        method: "GATE_PROSPECTO",
      });
      return;
    }
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
    guardando: actualizar.isPending,
    eliminando: eliminar.isPending,
    tomando: tomar.isPending,
    calificando: calificar.isPending,
  };
}
