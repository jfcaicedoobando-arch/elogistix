/**
 * Hook de las oportunidades de un prospecto (Fase 2 rediseño CRM).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  listOportunidadesPorLead,
  type OportunidadDeProspecto,
} from "@/features/crm/services/oportunidadesPorLead";

export type { OportunidadDeProspecto };

export function useOportunidadesPorLead(leadId: string | undefined) {
  return useQuery<OportunidadDeProspecto[]>({
    queryKey: queryKeys.crm.oportunidades.byLead(leadId ?? ""),
    enabled: !!leadId,
    staleTime: 30_000,
    queryFn: () => listOportunidadesPorLead(leadId!),
  });
}
