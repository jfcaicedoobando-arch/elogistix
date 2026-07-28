import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchAgenteContext,
  fetchAgenteTarifas,
  fetchAgenteEmbarques,
} from "@/features/portal-agente/services";

export function useAgenteContext() {
  // B-078: no disparar la query hasta que AuthContext resolvió la sesión;
  // el email sirve de respaldo si el roundtrip de auth falla (patrón B-059).
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: queryKeys.portalAgente.context(),
    queryFn: () => fetchAgenteContext(user?.email ?? null),
    enabled: !loading && !!user,
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
