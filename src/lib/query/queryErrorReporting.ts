import { notifyError } from "@/lib/ui/appFeedback";
import type { Query } from "@tanstack/react-query";

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

export function isExpectedBusinessError(err: unknown): boolean {
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
 * Devuelve también tags derivados (`pg_code`, `error_kind`).
 *
 * 13.823.16 (Sentry -5N/-5P) · un error sin mensaje ya no se titula
 * "unknown error": se clasifica como fallo de red / petición cancelada y se
 * incluye la consulta afectada para que el issue sea accionable y agrupe bien.
 */
function normalizeForSentry(
  err: unknown,
  rootKey?: string,
): { error: unknown; pgTags: Record<string, string> } {
  const sinMensaje =
    err instanceof Error
      ? err.message.length === 0
      : Boolean(err) && typeof err === "object" &&
        typeof (err as { message?: unknown }).message !== "string";
  if ((err instanceof Error && !sinMensaje) || !err || typeof err !== "object") {
    return { error: err, pgTags: {} };
  }
  const e = err as { code?: unknown; message?: unknown; status?: unknown };
  const pgTags: Record<string, string> = {};
  if (typeof e.code === "string") pgTags.pg_code = e.code;
  if (typeof e.status === "number") pgTags.http_status = String(e.status);

  const mensajeOriginal = typeof e.message === "string" ? e.message : "";
  if (mensajeOriginal.length > 0) {
    return { error: new Error(mensajeOriginal, { cause: err }), pgTags };
  }

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  pgTags.error_kind = offline ? "offline" : "network";
  const detalle = [
    rootKey ? `consulta: ${rootKey}` : undefined,
    typeof e.status === "number" ? `HTTP ${e.status}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  const base = offline
    ? "Sin conexión: la petición no llegó al servidor"
    : "Fallo de red o petición cancelada (respuesta sin mensaje)";
  const message = detalle ? `${base} (${detalle})` : base;
  return { error: new Error(message, { cause: err }), pgTags };
}


/**
 * Reporta a Sentry los errores que React Query rescata en su pipeline
 * (queries fallidas, mutations fallidas) — la mayoría de errores de red en
 * la app pasan por aquí y antes quedaban silenciosos si la UI sólo mostraba
 * un `toast.error`. Lazy import para no inflar el bundle inicial.
 */
export function reportQueryError(
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

const rootOf = (k: unknown): string | undefined => {
  const arr = k as unknown[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const v = arr[0];
  return typeof v === "string" ? v : undefined;
};

export const opOf = (k: unknown): string | undefined => {
  const arr = k as unknown[] | undefined;
  if (!Array.isArray(arr) || arr.length < 2) return undefined;
  const v = arr[1];
  return typeof v === "string" ? v : undefined;
};

export { rootOf };

/**
 * v13.303.75 · Notifica al usuario cuando una query falla. Antes sólo se
 * reportaba a Sentry y la UI mostraba un empty-state falso ("Sin resultados")
 * cuando en realidad falló la red. Ahora emitimos un toast con `id` estable
 * por queryKey para deduplicar cascadas y respetamos `meta.silentError` para
 * queries que ya manejan su propio feedback.
 */
export function notifyQueryFailure(
  err: unknown,
  query: Query<unknown, unknown, unknown, readonly unknown[]>,
  refetch: (queryKey: readonly unknown[]) => void,
): void {
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
      onClick: () => refetch(query.queryKey),
    },
  });
}
