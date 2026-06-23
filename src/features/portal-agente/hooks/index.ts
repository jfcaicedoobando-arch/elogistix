import { useQuery } from "@tanstack/react-query";
import {
  fetchAgenteContext,
  fetchAgenteTarifas,
  fetchAgenteEmbarques,
} from "@/features/portal-agente/services";

export function useAgenteContext() {
  return useQuery({
    queryKey: ["portal-agente", "context"],
    queryFn: fetchAgenteContext,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAgenteTarifas() {
  return useQuery({
    queryKey: ["portal-agente", "tarifas"],
    queryFn: fetchAgenteTarifas,
    staleTime: 60 * 1000,
  });
}

export function useAgenteEmbarques() {
  return useQuery({
    queryKey: ["portal-agente", "embarques"],
    queryFn: fetchAgenteEmbarques,
    staleTime: 60 * 1000,
  });
}
