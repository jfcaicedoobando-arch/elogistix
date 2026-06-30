/**
 * Clasifica errores capturados en uno de un set fijo de "kinds" para que
 * Sentry pueda agruparlos/filtrarlos rápido (`tag:error_kind=db_error`).
 *
 * Para errores de Postgres (PostgrestError vía supabase-js) además extrae
 * `code`, `hint` y `details` como campos planos: facilita búsquedas como
 * `tag:pg_code:42703` (column does not exist).
 *
 * 13.141.8 — auditoría Sentry: contexto enriquecido.
 */
export type ErrorKind =
  | "db_error"
  | "edge_function"
  | "auth"
  | "validation"
  | "network"
  | "unknown";

export interface ClassifiedError {
  kind: ErrorKind;
  pgCode?: string;
  pgHint?: string;
  pgDetails?: string;
}

interface MaybePgError {
  code?: unknown;
  hint?: unknown;
  details?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
  __isAuthError?: unknown;
  issues?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function classifyError(err: unknown): ClassifiedError {
  if (err === null || err === undefined) return { kind: "unknown" };

  const e = err as MaybePgError;
  const name = asString(e.name) ?? "";
  const message = asString(e.message) ?? "";
  const code = asString(e.code);

  // Postgres / PostgREST: trae code SQLSTATE (5 chars alfanuméricos).
  if (code && /^[0-9A-Z]{5}$/i.test(code)) {
    return {
      kind: "db_error",
      pgCode: code,
      pgHint: asString(e.hint),
      pgDetails: asString(e.details),
    };
  }

  // Supabase Edge Functions
  if (/FunctionsHttpError|FunctionsRelayError|FunctionsFetchError/.test(name)) {
    return { kind: "edge_function" };
  }

  // Supabase Auth
  if (e.__isAuthError === true || /AuthApiError|AuthError/.test(name)) {
    return { kind: "auth" };
  }
  const status = typeof e.status === "number" ? e.status : undefined;
  if (status === 401 || status === 403) return { kind: "auth" };

  // Zod / validación
  if (name === "ZodError" || Array.isArray(e.issues)) {
    return { kind: "validation" };
  }

  // Network
  if (name === "AbortError") return { kind: "network" };
  if (name === "TypeError" && /fetch|network/i.test(message)) {
    return { kind: "network" };
  }

  return { kind: "unknown" };
}
