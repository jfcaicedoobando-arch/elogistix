/**
 * Extracción de detalles de errores heterogéneos (Error, PostgrestError,
 * ZodError, objeto plano). Devuelve un payload estructurado consumible por el
 * reporter (`errorReport.ts`).
 *
 * - Detecta `ZodError` (instanceof o duck-typing) en el propio error o en
 *   `err.cause`, y mapea `issues` a `validationErrors`.
 * - Mantiene compatibilidad con PostgrestError (code/status/details/hint).
 * - Captura 1 nivel de `cause` para diagnóstico de errores envueltos
 *   (p.ej. `CfdiUploadError` que envuelve un `TypeError: Failed to fetch`).
 *
 * `deriveErrorCode` vive en `errorCodeDerive.ts` (Power of 10: split por tamaño)
 * y se re-exporta aquí para preservar la API pública previa.
 */
import type { ErrorReport } from "./errorReport";
import { findZodError, type MaybeZodError } from "./errorDetailsExtract.internal";

type Details = ErrorReport["errorDetails"];

;
import type { ValidationIssue } from "@/lib/diagnostics/errorReportTypes";
export { deriveErrorCode } from "./errorCodeDerive";

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

function strOr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function codeOr(v: unknown): string | number | undefined {
  return typeof v === "string" || typeof v === "number" ? v : undefined;
}

function statusOr(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
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
