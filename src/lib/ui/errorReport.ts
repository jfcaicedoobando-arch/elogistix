/**
 * Construye reportes de error completos y copiables para soporte/Lovable.
 * Captura: versión, ruta, usuario+organización, user agent, viewport, fase,
 * mensaje, código Postgrest/HTTP, stack, `context` arbitrario por call site,
 * y a partir de 12.0.0-rc.7: `requestId` (trace id), `errorCode` (catálogo
 * estandarizado) y `method` / `actionContext` (qué acción disparó el error).
 *
 * Para errores de validación (`ZodError` directo o vía `cause`), se extrae
 * automáticamente `errorDetails.validationErrors` con `path`, `message` y
 * `code` por issue.
 */
import { APP_VERSION } from "@/constants/appVersion";
import { getAuthSnapshot } from "@/lib/auth/authSnapshot";
import { extractErrorDetails, deriveErrorCode } from "./errorDetailsExtract";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { safeReportRecord, safeReportValue, safeReportJson } from "@/lib/diagnostics/safeReportValue";
import { trackErrorReportScope } from "@/lib/diagnostics/errorReportScope";
import {
  fmtHeader,
  fmtErrorBlock,
  fmtContextBlock,
  fmtStackBlock,
} from "@/lib/ui/errorReportFormat";

export type { ErrorReportInput, ErrorReport } from "@/lib/diagnostics/errorReportTypes";
import type { ErrorReport, ErrorReportInput } from "@/lib/diagnostics/errorReportTypes";

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback determinista solo para entornos sin crypto (tests muy antiguos).
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function reportCorrelation(input: ErrorReportInput, source: Record<string, unknown> | undefined) {
  const clientReportId = generateRequestId();
  const backendId = input.requestId ?? (typeof source?.requestId === "string" ? source.requestId : undefined);
  return { requestId: backendId ?? clientReportId, clientReportId,
    requestIdSource: backendId ? "backend" as const : "client" as const };
}

export function buildErrorReport(input: ErrorReportInput): ErrorReport {
  const auth = getAuthSnapshot();
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const route = typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : "";
  const viewport = typeof window !== "undefined"
    ? `${window.innerWidth}x${window.innerHeight}`
    : "";

  const source = safeReportRecord(input.error);
  const normalizedError = source ?? input.error;
  const errorDetails = extractErrorDetails(normalizedError);
  if (!errorDetails.message) errorDetails.message = input.description ?? input.title;
  const errorCode = input.errorCode ?? (input.errors ? ERROR_CODES.VALIDATION_FAILED : deriveErrorCode(normalizedError));

  return trackErrorReportScope({
    ...reportCorrelation(input, source),
    errorCode,
    method: input.method,
    title: input.title ?? "Error",
    description: input.description,
    phase: input.phase,
    step: input.step,
    version: APP_VERSION,
    timestampIso: now.toISOString(),
    timezone: tz,
    route,
    user: {
      id: auth.userId,
      email: auth.email,
      organizationId: auth.organizationId,
      organizationName: auth.organizationName,
      effectiveRole: auth.effectiveRole,
    },
    client: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport,
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    },
    errorDetails,
    context: safeReportRecord(input.context),
    payload: safeReportValue(input.payload),
    errors: input.errors,
  });
}

export function formatReportMarkdown(r: ErrorReport): string {
  return [
    ...fmtHeader(r),
    ...fmtErrorBlock(r.errorDetails),
    ...fmtContextBlock(r.context),
    ...fmtStackBlock(r.errorDetails.stack),
    "",
    "**Diagnóstico completo (JSON)**",
    "```json",
    formatReportJson(r),
    "```",
  ].join("\n");
}

export function formatReportJson(r: ErrorReport): string {
  return safeReportJson(r);
}
