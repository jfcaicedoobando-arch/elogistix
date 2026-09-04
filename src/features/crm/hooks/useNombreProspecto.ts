/**
 * Hidratación mínima del nombre del prospecto (lead) de una oportunidad.
 *
 * `crm_oportunidades` guarda `lead_id` pero NO el nombre del lead, así que al
 * editar una oportunidad originada en prospecto el selector en modo lectura
 * quedaba vacío ("Selecciona un prospecto…") y parecía que se había perdido
 * el vínculo. Este hook resuelve sólo la etiqueta: no toca el formulario, por
 * lo que guardar otros campos conserva `lead_id` intacto.
 */
import { useQuery } from "@tanstack/react-query";
import { getNombreLead } from "@/features/crm/services/leads";

export function useNombreProspecto(leadId: string | null) {
  return useQuery({
    queryKey: ["crm", "lead-nombre", leadId],
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getNombreLead(leadId as string),
  });
}
