/**
 * `deriveErrorCode`: mapea un error heterogéneo (Error nativo, PostgrestError,
 * ZodError, objeto con `status`, TypeError de red) a un `AppErrorCode`
 * estable del catálogo. Extraído de `errorDetailsExtract.ts` para mantener
 * ambos archivos < 200 líneas (regla Power of 10).
 */
import { ERROR_CODES, type AppErrorCode } from "@/lib/domain/errorCatalog";
import { findZodError } from "./errorDetailsExtract.internal";

interface MaybeShape {
  code?: unknown;
  status?: unknown;
  cause?: unknown;
}

function fromPostgrestCode(code: string, status: number | undefined): AppErrorCode {
  if (code === "42501" || status === 403) return ERROR_CODES.FORBIDDEN;
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (code === "23505") return ERROR_CODES.CONFLICT;
  return ERROR_CODES.DB_ERROR;
}

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

export function deriveErrorCode(err: unknown): AppErrorCode {
  if (err == null) return ERROR_CODES.UNKNOWN;
  if (findZodError(err)) return ERROR_CODES.VALIDATION_FAILED;

  const e = (err && typeof err === "object" ? err : {}) as MaybeShape;
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
