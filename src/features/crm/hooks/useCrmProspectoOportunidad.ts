/**
 * CRM-COT-01 — ¿esta oportunidad sin cliente es un prospecto elegible para
 * cotizar? Usa la misma elegibilidad que el buscador del wizard.
 */
import { useQuery } from "@tanstack/react-query";
import {
  buscarProspectoOportunidad,
  type ProspectoMatch,
} from "@/features/crm/services/prospectoSearch";
import { queryKeys } from "@/lib/query";

export function useCrmProspectoOportunidad(
  oportunidadId: string | null | undefined,
  enabled = true,
) {
  const id = oportunidadId ?? "";
  return useQuery<ProspectoMatch | null>({
    queryKey: queryKeys.crm.prospectoOportunidad(id),
    enabled: enabled && id.length > 0,
    staleTime: 30_000,
    queryFn: () => buscarProspectoOportunidad(id),
  });
}
