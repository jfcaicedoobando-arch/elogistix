import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { fetchCarteraSnapshot, isCarteraScopeCurrent, type CarteraDataScope } from "../services/carteraSnapshot";
import { carteraKeys } from "../queryKeys";

export function useCarteraSnapshot(diaNegocio: string) {
  const { organizationId, loading } = useOrganization();
  const generation = useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration);
  const { userId, role } = captureAuthDataScope();
  const scope: CarteraDataScope = { userId, organizationId, role, generation };
  const ready = !loading && isCarteraScopeCurrent(scope);
  const query = useQuery({
    queryKey: carteraKeys.snapshot(scope, diaNegocio),
    queryFn: async () => ({ ...await fetchCarteraSnapshot(scope, diaNegocio), diaNegocio }),
    placeholderData: undefined,
    enabled: ready,
    staleTime: 30_000,
  });
  // No convierte filas guardadas en otro ámbito en un snapshot del tenant actual.
  const dataReady = ready && !query.isFetching && !query.isError
    && !query.isPlaceholderData && query.data?.diaNegocio === diaNegocio
    && isCarteraScopeCurrent(query.data?.scope);
  return {
    data: dataReady ? query.data : undefined,
    isLoading: !ready || query.isPending || query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
