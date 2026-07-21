import { QueryClient, QueryCache, MutationCache, type Query } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { toast } from "sonner";
import { getStorageRef, STORAGE_KEYS } from "@/lib/browserStorage";

/**
 * Errores de negocio esperados que NO deben generar un issue en Sentry:
 * Postgres `RAISE EXCEPTION` sin código explícito devuelve `P0001`, que usamos
 * para validaciones de permisos / reglas de negocio a nivel de RPC (p.ej.
 * "No tienes permiso para convertir proformas a factura"). Estos errores ya
 * los presenta la UI con `notifyError`; no son bugs de infraestructura.
 */
function isExpectedBusinessError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && code === "P0001";
}

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
  opKey?: string | undefined,
): void {
  // 13.114.18: queryKey[0] y mutationKey[0] se promueven a `tags` para poder
  // filtrar/agrupar en Sentry (los `extra` no son indexables).
  // 13.137.15: mutationKey[1] se promueve como `mutation_op` para distinguir
  // sub-flujos (ej. ["fiscal","emitir-rep"] vs ["fiscal","cancelar-rep"]).
  // 13.145.6: los errores de negocio (Postgres P0001) se dejan como
  // breadcrumb en lugar de crear un issue — no son bugs.
  if (isExpectedBusinessError(err)) {
    void import("@sentry/react")
      .then(({ addBreadcrumb }) =>
        addBreadcrumb({
          category: "react_query",
          level: "info",
          message: `business_error:${kind}:${rootKey ?? "?"}:${opKey ?? "?"}`,
          data: meta,
        }),
      )
      .catch(() => undefined);
    return;
  }
  const tags: Record<string, string> = { feature: "react_query", kind };
  if (rootKey) tags[kind === "query" ? "query_root" : "mutation_root"] = rootKey.slice(0, 64);
  if (opKey && kind === "mutation") tags.mutation_op = opKey.slice(0, 64);
  void import("@sentry/react")
    .then(({ captureException }) =>
      captureException(err, { tags, extra: meta }),
    )
    .catch(() => undefined);
}

/**
 * v13.303.75 · Notifica al usuario cuando una query falla. Antes sólo se
 * reportaba a Sentry y la UI mostraba un empty-state falso ("Sin resultados")
 * cuando en realidad falló la red. Ahora emitimos un toast con `id` estable
 * por queryKey para deduplicar cascadas y respetamos `meta.silentError` para
 * queries que ya manejan su propio feedback.
 */
function notifyQueryFailure(err: unknown, query: Query<unknown, unknown, unknown, readonly unknown[]>): void {
  if (isExpectedBusinessError(err)) return;
  const meta = query.meta as { silentError?: boolean } | undefined;
  if (meta?.silentError) return;
  const root = rootOf(query.queryKey) ?? "data";
  toast.error("No pudimos cargar la información", {
    id: `query-error:${root}`,
    description: "Revisa tu conexión e intenta de nuevo.",
  });
}

const rootOf = (k: unknown): string | undefined => {
  const arr = k as unknown[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const v = arr[0];
  return typeof v === "string" ? v : undefined;
};

const opOf = (k: unknown): string | undefined => {
  const arr = k as unknown[] | undefined;
  if (!Array.isArray(arr) || arr.length < 2) return undefined;
  const v = arr[1];
  return typeof v === "string" ? v : undefined;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) => {
      reportQueryError(err, "query", rootOf(query.queryKey), { queryKey: query.queryKey });
      notifyQueryFailure(err, query);
    },
  }),
  mutationCache: new MutationCache({
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
