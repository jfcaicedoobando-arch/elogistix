import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AuthOperationChangedError, captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { catalogScopeKey, removeStaleCatalogQueries } from "@/lib/query/catalogScope";

interface CatalogQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: (scope: ReturnType<typeof captureAuthDataScope>) => Promise<T>;
  staleTime: number;
}

/** Sólo los catálogos autenticados: sesión, rol y tenant revocan lectura y caché. */
export function useCatalogQuery<T>({ queryKey, queryFn, staleTime }: CatalogQueryOptions<T>) {
  const generation = useSyncExternalStore(
    subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration,
  );
  const scope = captureAuthDataScope();
  const client = useQueryClient();
  useEffect(() => removeStaleCatalogQueries(client, generation), [client, generation]);

  return useQuery<T>({
    queryKey: catalogScopeKey(queryKey, scope),
    enabled: Boolean(scope.userId && scope.role),
    placeholderData: undefined,
    meta: { catalogSessionGeneration: generation },
    staleTime,
    queryFn: async ({ signal }) => {
      scope.assertCurrent();
      // refetch() puede invocarse aun cuando enabled=false.
      if (!scope.userId || !scope.role) throw new AuthOperationChangedError();
      const data = await queryFn(scope);
      scope.assertCurrent();
      if (signal.aborted) throw new AuthOperationChangedError();
      return data;
    },
  });
}
