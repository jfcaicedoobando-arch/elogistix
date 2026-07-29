import { QueryClient, QueryCache, MutationCache, type Query } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { notifyError } from "@/lib/ui/appFeedback";
import { getStorageRef, STORAGE_KEYS } from "@/lib/browserStorage";

/**
 * Errores esperados que NO deben generar un issue en Sentry:
 * - Postgres `P0001`: RAISE EXCEPTION de reglas de negocio (permisos, guards).
 * - Clases de dominio (`AprobacionFacturaError`, `CreditLimitError`, etc.):
 *   validaciones controladas que la UI ya presenta con `notifyError`.
 * - Timeouts de gateway (504 / "upstream request timeout"): infra, no bug.
 * - Validaciones de captura conocidas ("Debe seleccionar…").
 * Ver mem plan Sentry 13.302.7.
 */
const BUSINESS_ERROR_NAMES = new Set<string>([
  "AprobacionFacturaError",
  "CreditLimitError",
  "ValidationError",
  "ZodError",
]);

const BUSINESS_ERROR_MESSAGE_HINTS = [
  "debe seleccionar al menos",
  "upstream request timeout",
];

function isExpectedBusinessError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; name?: unknown; message?: unknown; status?: unknown };
  if (typeof e.code === "string" && e.code === "P0001") return true;
  // 13.338.0 — 23514 (check constraint) son guardas de negocio: "Embarque
  // cerrado: edición bloqueada". La UI ya lo explica. Ver Sentry -40.
  if (typeof e.code === "string" && e.code === "23514") return true;
  if (typeof e.name === "string" && BUSINESS_ERROR_NAMES.has(e.name)) return true;
  if (e.status === 504) return true;
  if (typeof e.message === "string") {
    const msg = e.message.toLowerCase();
    if (BUSINESS_ERROR_MESSAGE_HINTS.some((h) => msg.includes(h))) return true;
  }
  return false;
}

/**
 * Convierte errores crudos de PostgREST (objetos planos con `code`, `details`,
 * `hint`, `message`) en `Error` reales para que Sentry agrupe por mensaje en
 * vez de titular "Object captured as exception with keys: …" o "M".
 * Devuelve también tags derivados (`pg_code`).
 */
function normalizeForSentry(err: unknown): { error: unknown; pgTags: Record<string, string> } {
  if (err instanceof Error || !err || typeof err !== "object") {
    return { error: err, pgTags: {} };
  }
  const e = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const message = typeof e.message === "string" && e.message.length > 0
    ? e.message
    : "unknown error";
  const normalized = new Error(message, { cause: err });
  const pgTags: Record<string, string> = {};
  if (typeof e.code === "string") pgTags.pg_code = e.code;
  return { error: normalized, pgTags };
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
  const { error: normalized, pgTags } = normalizeForSentry(err);
  const tags: Record<string, string> = { feature: "react_query", kind, ...pgTags };
  if (rootKey) tags[kind === "query" ? "query_root" : "mutation_root"] = rootKey.slice(0, 64);
  if (opKey && kind === "mutation") tags.mutation_op = opKey.slice(0, 64);
  void import("@sentry/react")
    .then(({ captureException }) =>
      captureException(normalized, { tags, extra: meta }),
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
  // v13.308.7 · migra a notifyError para incluir "Ver detalles" (payload
  // copiable con queryKey + stack). Nota: notifyError NO respeta `id` de
  // dedupe (sonner ignora `id` en `toast.error` con action). Aceptamos que
  // cascadas de queries fallidas puedan encolar varios toasts — el usuario
  // los descarta con "close all" y a cambio ve el error real.
  notifyError(undefined, {
    title: "No pudimos cargar la información",
    description: "Revisa tu conexión e intenta de nuevo.",
    error: err,
    method: "QUERY_CACHE",
    context: { queryKey: query.queryKey, root },
    // Q-08: la acción primaria reintenta en el lugar; nunca navega fuera de
    // la pantalla (antes se perdía el wizard de cotización a medio llenar).
    action: {
      label: "Reintentar",
      onClick: () => { void queryClient.refetchQueries({ queryKey: query.queryKey }); },
    },
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
      // P-06 (auditoría E2E 2026-07-29): 2 reintentos con backoff exponencial
      // acotado; antes un fallo transitorio dejaba la pantalla en skeleton.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

/**
 * Persister para catálogos verdaderamente estáticos (tasa IVA vigente y tipos
 * de cambio del día, que se re-consultan por su propio staleTime aunque estén
 * hidratados). B-015 (v13.320.41): se removieron `tipos_contenedor`,
 * `navieras`, `puertos` y `configuracion` porque son administrables y quedaban
 * congelados en localStorage hasta 24 h tras editarlos en la app. Ahora se
 * refetchean al primer montaje de cada sesión.
 */
const CATALOG_KEYS = new Set([
  "tasa_iva",
  "exchange-rates",
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
