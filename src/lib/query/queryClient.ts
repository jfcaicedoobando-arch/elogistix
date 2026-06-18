import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { getStorageRef, STORAGE_KEYS } from "@/lib/browserStorage";

/**
 * Reporta a Sentry los errores que React Query rescata en su pipeline
 * (queries fallidas, mutations fallidas) — la mayoría de errores de red en
 * la app pasan por aquí y antes quedaban silenciosos si la UI sólo mostraba
 * un `toast.error`. Lazy import para no inflar el bundle inicial.
 */
function reportQueryError(
  err: unknown,
  kind: "query" | "mutation",
  meta?: Record<string, unknown>,
): void {
  void import("@sentry/react")
    .then(({ captureException }) =>
      captureException(err, { tags: { feature: "react_query", kind }, extra: meta }),
    )
    .catch(() => undefined);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) =>
      reportQueryError(err, "query", { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) =>
      reportQueryError(err, "mutation", { mutationKey: mutation.options.mutationKey }),
  }),
  defaultOptions: {
    queries: {
      // 12.34.0: subido de 30s → 60s para reducir refetches innecesarios al
      // navegar entre pantallas. Los hooks que necesiten mayor frescura
      // pueden sobrescribir con su propio staleTime.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  },
});

/**
 * Persister para catálogos estáticos: puertos, navieras, tipos de contenedor,
 * tasa IVA y tipos de cambio. Sólo estas queries (whitelist por queryKey[0])
 * se serializan a localStorage para sobrevivir refresh sin volver a pegarle al
 * backend, recortando 200-400 ms del TTI en pantallas con selects.
 */
const CATALOG_KEYS = new Set([
  "puertos",
  "navieras",
  "tipos_contenedor",
  "tasa_iva",
  "exchange-rates",
  "configuracion",
]);

export const queryPersister = createSyncStoragePersister({
  storage: getStorageRef("local"),
  key: STORAGE_KEYS.queryCache,
  throttleTime: 1000,
});

export const shouldDehydrateCatalogQuery = (queryKey: unknown, status: string) => {
  const root = String((queryKey as unknown[])?.[0] ?? "");
  return CATALOG_KEYS.has(root) && status === "success";
};
