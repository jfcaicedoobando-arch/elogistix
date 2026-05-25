import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "lc-query-cache-v1",
  throttleTime: 1000,
});

export const shouldDehydrateCatalogQuery = (queryKey: unknown, status: string) => {
  const root = String((queryKey as unknown[])?.[0] ?? "");
  return CATALOG_KEYS.has(root) && status === "success";
};
