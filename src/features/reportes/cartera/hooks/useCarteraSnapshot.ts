import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDiaNegocio } from "@/hooks/shared/useDiaNegocio";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { fetchCarteraSnapshot, isCarteraScopeCurrent, type CarteraDataScope } from "../services/carteraSnapshot";
import { carteraKeys } from "../queryKeys";

export function useCarteraSnapshot() {
  const { organizationId, loading } = useOrganization();
  const diaNegocio = useDiaNegocio();
  const generation = useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration);
  const { userId, role } = captureAuthDataScope();
  const scope: CarteraDataScope = { userId, organizationId, role, generation };
  const ready = !loading && isCarteraScopeCurrent(scope);
  const query = useQuery({
    queryKey: carteraKeys.snapshot(scope, diaNegocio),
    queryFn: () => fetchCarteraSnapshot(scope, diaNegocio),
    enabled: ready,
    staleTime: 30_000,
  });
  // No convierte filas guardadas en otro ámbito en un snapshot del tenant actual.
  const dataReady = ready && !query.isFetching && !query.isError
    && isCarteraScopeCurrent(query.data?.scope);
  return {
    data: dataReady ? query.data : undefined,
    isLoading: !ready || query.isPending || query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
