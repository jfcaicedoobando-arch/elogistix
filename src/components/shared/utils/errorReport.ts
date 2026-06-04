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
import { getAuthSnapshot } from "@/components/shared/utils/authSnapshot";
import { extractErrorDetails, deriveErrorCode, type ValidationIssue } from "./errorDetailsExtract";
import { ERROR_CODES, type AppErrorCode } from "@/lib/domain/errorCatalog";
import {
  fmtHeader,
  fmtErrorBlock,
  fmtContextBlock,
  fmtStackBlock,
} from "./errorReportFormat";

export interface ErrorReportInput {
  title?: string;
  description?: string;
  phase?: string;
  step?: number;
  error?: unknown;
  context?: Record<string, unknown>;
  /** Override del código de error (si no se pasa, se infiere del error). */
  errorCode?: AppErrorCode | string;
  /**
   * Acción que disparó el error: método HTTP ("POST", "DELETE") o un
   * identificador semántico de acción ("SAVE_DRAFT_COTIZACION").
   */
  method?: string;
  /** Override del request/trace id (si no se pasa, se genera con UUID v4). */
  requestId?: string;
}

export interface ErrorReport {
  /** UUID v4 que correlaciona logs cliente ↔ backend ↔ Sentry. */
  requestId: string;
  /** Código estandarizado del catálogo (`ERROR_CODES.*`). */
  errorCode: AppErrorCode | string;
  /** Método HTTP o acción semántica que originó el error. */
  method?: string;
  title: string;
  description?: string;
  phase?: string;
  step?: number;
  version: string;
  timestampIso: string;
  timezone: string;
  route: string;
  user: {
    id: string | null;
    email: string | null;
    organizationId: string | null;
    organizationName: string | null;
    effectiveRole: string | null;
  };
  client: {
    userAgent: string;
    viewport: string;
    devicePixelRatio: number;
  };
  errorDetails: {
    message?: string;
    name?: string;
    code?: string | number;
    status?: number;
    details?: string;
    hint?: string;
    stack?: string;
    /** Issues de Zod cuando el error proviene de validación. */
    validationErrors?: ValidationIssue[];
  };
  context?: Record<string, unknown>;
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback determinista solo para entornos sin crypto (tests muy antiguos).
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

  const errorDetails = extractErrorDetails(input.error);
  const errorCode = input.errorCode ?? deriveErrorCode(input.error) ?? ERROR_CODES.UNKNOWN;

  return {
    requestId: input.requestId ?? generateRequestId(),
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
    context: input.context,
  };
}

export function formatReportMarkdown(r: ErrorReport): string {
  return [
    ...fmtHeader(r),
    ...fmtErrorBlock(r.errorDetails),
    ...fmtContextBlock(r.context),
    ...fmtStackBlock(r.errorDetails.stack),
  ].join("\n");
}

export function formatReportJson(r: ErrorReport): string {
  return JSON.stringify(r, null, 2);
}
