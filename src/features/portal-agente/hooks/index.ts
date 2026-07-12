import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchAgenteContext,
  fetchAgenteTarifas,
  fetchAgenteEmbarques,
} from "@/features/portal-agente/services";

export function useAgenteContext() {
  return useQuery({
    queryKey: queryKeys.portalAgente.context(),
    queryFn: fetchAgenteContext,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAgenteTarifas() {
  return useQuery({
    queryKey: queryKeys.portalAgente.tarifas(),
    queryFn: fetchAgenteTarifas,
    staleTime: 60 * 1000,
  });
}

export function useAgenteEmbarques() {
  return useQuery({
    queryKey: queryKeys.portalAgente.embarques(),
    queryFn: fetchAgenteEmbarques,
    staleTime: 60 * 1000,
  });
}
