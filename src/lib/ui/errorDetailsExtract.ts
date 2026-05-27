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

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

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

/** Busca un ZodError en el error o en su cadena `cause`. */
function findZodError(err: unknown): MaybeZodError | null {
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    const z = asZodError(current);
    if (z) return z;
    if (typeof current === "object" && current !== null && "cause" in current) {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
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
  return base;
}

/** Deriva un `errorCode` estable a partir de la forma del error. */
export function deriveErrorCode(err: unknown): AppErrorCode {
  if (err == null) return ERROR_CODES.UNKNOWN;
  if (findZodError(err)) return ERROR_CODES.VALIDATION_FAILED;

  const e = (err && typeof err === "object" ? err : {}) as MaybePostgrestError;
  const code = e.code;
  const status = typeof e.status === "number" ? e.status : undefined;

  // PostgrestError: code es string tipo "42501", "23505", "PGRST116"…
  if (typeof code === "string" && /^(PGRST|[0-9]{5})/.test(code)) {
    if (code === "42501" || status === 403) return ERROR_CODES.FORBIDDEN;
    if (status === 401) return ERROR_CODES.UNAUTHORIZED;
    if (code === "23505") return ERROR_CODES.CONFLICT;
    return ERROR_CODES.DB_ERROR;
  }
  if (typeof status === "number") {
    if (status === 401) return ERROR_CODES.UNAUTHORIZED;
    if (status === 403) return ERROR_CODES.FORBIDDEN;
    if (status === 404) return ERROR_CODES.NOT_FOUND;
    if (status === 409) return ERROR_CODES.CONFLICT;
    if (status >= 500) return ERROR_CODES.SERVER_ERROR;
    if (status >= 400) return ERROR_CODES.CLIENT_ERROR;
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  return ERROR_CODES.UNKNOWN;
}
