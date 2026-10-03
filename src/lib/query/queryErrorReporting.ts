import { notifyError } from "@/lib/ui/appFeedback";
import type { Query } from "@tanstack/react-query";
import { isExpectedTelemetryError } from "@/lib/observability/expectedTelemetryError";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";


export function isExpectedBusinessError(err: unknown): boolean {
  return isExpectedTelemetryError(err);
}

/**
 * Construye título y `error_kind` para un error sin mensaje (red o petición
 * cancelada). Extraído de `normalizeForSentry` para acotar su complejidad.
 */
function describirErrorSinMensaje(
  rootKey: string | undefined,
  status: unknown,
): { kind: "offline" | "network"; message: string } {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const partes: string[] = [];
  if (rootKey) partes.push(`consulta: ${rootKey}`);
  if (typeof status === "number") partes.push(`HTTP ${status}`);
  const base = offline
    ? "Sin conexión: la petición no llegó al servidor"
    : "Fallo de red o petición cancelada (respuesta sin mensaje)";
  return {
    kind: offline ? "offline" : "network",
    message: partes.length > 0 ? `${base} (${partes.join(", ")})` : base,
  };
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
  const e = err as { code?: unknown; message?: unknown; status?: unknown; expected?: unknown };
  const pgTags: Record<string, string> = {};
  if (typeof e.code === "string") pgTags.pg_code = e.code;
  if (typeof e.status === "number") pgTags.http_status = String(e.status);

  const mensajeOriginal = typeof e.message === "string" ? e.message : "";
  if (mensajeOriginal.length > 0) {
    return { error: Object.assign(new Error(mensajeOriginal, { cause: err }),
      { code: e.code, expected: e.expected }), pgTags };
  }

  const clasificado = describirErrorSinMensaje(rootKey, e.status);
  pgTags.error_kind = clasificado.kind;
  const message = clasificado.message;
  return { error: Object.assign(new Error(message, { cause: err }),
    { code: e.code, expected: e.expected }), pgTags };
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
  const { error: normalized, pgTags } = normalizeForSentry(err, rootKey);
  const tags: Record<string, string> & { feature: string } = { feature: "react_query", kind, ...pgTags };
  if (rootKey) tags[kind === "query" ? "query_root" : "mutation_root"] = rootKey.slice(0, 64);
  if (opKey && kind === "mutation") tags.mutation_op = opKey.slice(0, 64);
  reportCaughtError(normalized, tags, meta);
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
  // La operación + queryKey identifican el aviso: una repetición actualiza
  // el JSON sin suprimir el error más reciente ni mezclar consultas distintas.
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
