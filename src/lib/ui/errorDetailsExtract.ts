/**
 * Extracción de detalles de errores heterogéneos (Error, PostgrestError, objeto plano).
 * Extraído de `errorReport.ts` para mantener complejidad <15.
 */
import type { ErrorReport } from "./errorReport";

type Details = ErrorReport["errorDetails"];

interface MaybePostgrestError {
  message?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
  stack?: unknown;
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
  if (err instanceof Error) return fromErrorInstance(err);
  if (typeof err === "object") return fromObject(err);
  return { message: String(err) };
}
