import { invalidateSessionCacheEntries } from "@/lib/auth/sessionCacheRegistry";
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { getStorageRef, STORAGE_KEYS } from "@/lib/browserStorage";
import { reportQueryError, notifyQueryFailure, rootOf, opOf } from "./queryErrorReporting";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) => {
      reportQueryError(err, "query", rootOf(query.queryKey), { queryKey: query.queryKey });
      notifyQueryFailure(err, query, (queryKey) => {
        void queryClient.refetchQueries({ queryKey });
      });
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: () => invalidateSessionCacheEntries(),
    onError: (err, _vars, _ctx, mutation) =>
      reportQueryError(
        err,
        "mutation",
        rootOf(mutation.options.mutationKey),
        { mutationKey: mutation.options.mutationKey },
        opOf(mutation.options.mutationKey),
      ),
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
      // P-06 (auditoría E2E 2026-07-29): 2 reintentos con backoff exponencial
      // acotado; antes un fallo transitorio dejaba la pantalla en skeleton.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

/**
 * Sólo se persisten tipos de cambio públicos, que se re-consultan por su
 * propio staleTime aunque estén hidratados. `tasa_iva` era un vestigio:
 * useTasaIVA devuelve una constante desde 13.170.0.
 * B-015 (v13.320.41): se removieron `tipos_contenedor`,
 * `navieras`, `puertos` y `configuracion` porque son administrables y quedaban
 * congelados en localStorage hasta 24 h tras editarlos en la app. Ahora se
 * refetchean al primer montaje de cada sesión.
 */
export const PERSISTED_CATALOG_MAX_AGE = 24 * 60 * 60 * 1000;
export const PERSISTED_CATALOG_BUSTER = "exchange-rates-only-v2";

// El GC no debe borrar las tasas inactivas antes que el snapshot persistido.
// El prefijo incluye hoy, fecha histórica y DOF por fecha; no cambia staleTime
// ni amplía la retención global de datos operativos (5 minutos).
queryClient.setQueryDefaults(["exchange-rates"], { gcTime: PERSISTED_CATALOG_MAX_AGE });

export const queryPersister = createSyncStoragePersister({
  storage: getStorageRef("local"),
  key: STORAGE_KEYS.queryCache,
  throttleTime: 1000,
});

export const shouldDehydrateCatalogQuery = (queryKey: unknown, status: string) => {
  return Array.isArray(queryKey) && queryKey[0] === "exchange-rates" && status === "success";
};
