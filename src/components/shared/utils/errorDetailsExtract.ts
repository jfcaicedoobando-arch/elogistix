/**
 * Extracción de detalles de errores heterogéneos (Error, PostgrestError,
 * ZodError, objeto plano). Devuelve un payload estructurado consumible por el
 * reporter (`errorReport.ts`).
 *
 * - Detecta `ZodError` (instanceof o duck-typing) en el propio error o en
 *   `err.cause`, y mapea `issues` a `validationErrors`.
 * - Mantiene compatibilidad con PostgrestError (code/status/details/hint).
 * - Devuelve también un `errorCode` estandarizado cuando se puede inferir.
 */
import type { ErrorReport } from "./errorReport";
import { ERROR_CODES, type AppErrorCode } from "@/lib/domain/errorCatalog";

type Details = ErrorReport["errorDetails"];

export type { ValidationIssue } from "@/lib/diagnostics/errorReportTypes";
import type { ValidationIssue } from "@/lib/diagnostics/errorReportTypes";

interface MaybePostgrestError {
  message?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
  stack?: unknown;
  cause?: unknown;
}

interface MaybeZodError {
  name?: unknown;
  issues?: unknown;
  errors?: unknown;
}

function strOr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function codeOr(v: unknown): string | number | undefined {
  return typeof v === "string" || typeof v === "number" ? v : undefined;
}

function statusOr(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

/** Duck-typing: evita acoplar este módulo a la importación de zod. */
function asZodError(v: unknown): MaybeZodError | null {
  if (!v || typeof v !== "object") return null;
  const z = v as MaybeZodError;
  if (z.name === "ZodError" && Array.isArray(z.issues)) return z;
  // Algunos wrappers exponen `errors` en lugar de `issues`.
  if (z.name === "ZodError" && Array.isArray(z.errors)) return z;
  return null;
}

function mapValidationIssues(zod: MaybeZodError): ValidationIssue[] {
  const raw = Array.isArray(zod.issues) ? zod.issues : Array.isArray(zod.errors) ? zod.errors : [];
  return raw.map((i) => {
    const it = (i ?? {}) as { path?: unknown; message?: unknown; code?: unknown };
    const path = Array.isArray(it.path)
      ? it.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number")
      : [];
    return {
      path,
      message: typeof it.message === "string" ? it.message : String(it.message ?? ""),
      code: typeof it.code === "string" ? it.code : "invalid",
    };
  });
}

/**
 * Busca un ZodError en el error o en su cadena `cause`.
 * Guarda objetos visitados en un `WeakSet` para no entrar en bucle infinito
 * si algún error tiene una referencia cíclica en `cause`.
 */
function findZodError(err: unknown): MaybeZodError | null {
  const seen = new WeakSet<object>();
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    const z = asZodError(current);
    if (z) return z;
    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) break;
      seen.add(current);
      if ("cause" in current) {
        current = (current as { cause?: unknown }).cause;
        continue;
      }
    }
    break;
  }
  return null;
}

function fromErrorInstance(err: Error): Details {
  const anyErr = err as Error & MaybePostgrestError;
  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
    code: codeOr(anyErr.code),
    status: statusOr(anyErr.status),
    details: strOr(anyErr.details),
    hint: strOr(anyErr.hint),
  };
}

function fromObject(err: unknown): Details {
  const e = err as MaybePostgrestError;
  return {
    message: strOr(e.message) ?? JSON.stringify(err),
    name: strOr(e.name),
    code: codeOr(e.code),
    status: statusOr(e.status),
    details: strOr(e.details),
    hint: strOr(e.hint),
    stack: strOr(e.stack),
  };
}

/** Extrae 1 nivel de `cause` como objeto plano (sin recursión profunda). */
function extractCause(err: unknown): Details["cause"] | undefined {
  if (!err || typeof err !== "object") return undefined;
  const c = (err as { cause?: unknown }).cause;
  if (!c) return undefined;
  if (c instanceof Error) {
    const anyC = c as Error & MaybePostgrestError;
    return {
      name: c.name,
      message: c.message,
      code: codeOr(anyC.code),
      status: statusOr(anyC.status),
    };
  }
  if (typeof c === "object") {
    const o = c as MaybePostgrestError;
    return {
      name: strOr(o.name),
      message: strOr(o.message),
      code: codeOr(o.code),
      status: statusOr(o.status),
    };
  }
  if (typeof c === "string") return { message: c };
  return undefined;
}

export function extractErrorDetails(err: unknown): Details {
  if (err == null) return {};
  if (typeof err === "string") return { message: err };

  let base: Details;
  if (err instanceof Error) base = fromErrorInstance(err);
  else if (typeof err === "object") base = fromObject(err);
  else return { message: String(err) };

  const zod = findZodError(err);
  if (zod) {
    base.validationErrors = mapValidationIssues(zod);
    if (!base.name || base.name === "Error") base.name = "ZodError";
  }
  const cause = extractCause(err);
  if (cause) base.cause = cause;
  return base;
}

/** Mapea códigos PostgREST/Postgres → AppErrorCode. */
function fromPostgrestCode(code: string, status: number | undefined): AppErrorCode {
  if (code === "42501" || status === 403) return ERROR_CODES.FORBIDDEN;
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (code === "23505") return ERROR_CODES.CONFLICT;
  return ERROR_CODES.DB_ERROR;
}

/** Mapea status HTTP → AppErrorCode. */
function fromHttpStatus(status: number): AppErrorCode | null {
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.FORBIDDEN;
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status === 409) return ERROR_CODES.CONFLICT;
  if (status >= 500) return ERROR_CODES.SERVER_ERROR;
  if (status >= 400) return ERROR_CODES.CLIENT_ERROR;
  return null;
}

/** ¿Es un TypeError de red ("Failed to fetch" / "network")? */
function isNetworkTypeError(v: unknown): boolean {
  if (!v) return false;
  if (v instanceof TypeError && /fetch|network/i.test(v.message)) return true;
  if (typeof v === "object") {
    const o = v as { name?: unknown; message?: unknown };
    if (o.name === "TypeError" && typeof o.message === "string" && /fetch|network/i.test(o.message)) {
      return true;
    }
  }
  return false;
}

/** Deriva un `errorCode` estable a partir de la forma del error. */
export function deriveErrorCode(err: unknown): AppErrorCode {
  if (err == null) return ERROR_CODES.UNKNOWN;
  if (findZodError(err)) return ERROR_CODES.VALIDATION_FAILED;

  const e = (err && typeof err === "object" ? err : {}) as MaybePostgrestError;
  const code = e.code;
  const status = typeof e.status === "number" ? e.status : undefined;

  if (typeof code === "string" && /^(PGRST|[0-9]{5})/.test(code)) {
    return fromPostgrestCode(code, status);
  }
  if (typeof status === "number") {
    const mapped = fromHttpStatus(status);
    if (mapped) return mapped;
  }
  if (isNetworkTypeError(err) || isNetworkTypeError(e.cause)) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  return ERROR_CODES.UNKNOWN;
}
