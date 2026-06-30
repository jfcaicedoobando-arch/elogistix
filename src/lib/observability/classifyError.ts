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

function detectPgError(e: MaybePgError): ClassifiedError | null {
  const code = asString(e.code);
  if (code && /^[0-9A-Z]{5}$/i.test(code)) {
    return {
      kind: "db_error",
      pgCode: code,
      pgHint: asString(e.hint),
      pgDetails: asString(e.details),
    };
  }
  return null;
}

function detectEdgeFunction(name: string): boolean {
  return /FunctionsHttpError|FunctionsRelayError|FunctionsFetchError/.test(name);
}

function detectAuth(e: MaybePgError, name: string, status: number | undefined): boolean {
  if (e.__isAuthError === true) return true;
  if (/AuthApiError|AuthError/.test(name)) return true;
  return status === 401 || status === 403;
}

function detectValidation(e: MaybePgError, name: string): boolean {
  return name === "ZodError" || Array.isArray(e.issues);
}

function detectNetwork(name: string, message: string): boolean {
  if (name === "AbortError") return true;
  return name === "TypeError" && /fetch|network/i.test(message);
}

export function classifyError(err: unknown): ClassifiedError {
  if (err === null || err === undefined) return { kind: "unknown" };

  const e = err as MaybePgError;
  const name = asString(e.name) ?? "";
  const message = asString(e.message) ?? "";
  const status = typeof e.status === "number" ? e.status : undefined;

  const pg = detectPgError(e);
  if (pg) return pg;
  if (detectEdgeFunction(name)) return { kind: "edge_function" };
  if (detectAuth(e, name, status)) return { kind: "auth" };
  if (detectValidation(e, name)) return { kind: "validation" };
  if (detectNetwork(name, message)) return { kind: "network" };
  return { kind: "unknown" };
}
