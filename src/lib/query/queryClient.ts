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
  rootKey: string | undefined,
  meta?: Record<string, unknown>,
): void {
  // 13.114.18: queryKey[0] y mutationKey[0] se promueven a `tags` para poder
  // filtrar/agrupar en Sentry (los `extra` no son indexables).
  const tags: Record<string, string> = { feature: "react_query", kind };
  if (rootKey) tags[kind === "query" ? "query_root" : "mutation_root"] = rootKey.slice(0, 64);
  void import("@sentry/react")
    .then(({ captureException }) =>
      captureException(err, { tags, extra: meta }),
    )
    .catch(() => undefined);
}

const rootOf = (k: unknown): string | undefined => {
  const arr = k as unknown[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const v = arr[0];
  return typeof v === "string" ? v : undefined;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) =>
      reportQueryError(err, "query", rootOf(query.queryKey), { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) =>
      reportQueryError(err, "mutation", rootOf(mutation.options.mutationKey), {
        mutationKey: mutation.options.mutationKey,
      }),
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
