/**
 * Construye reportes de error completos y copiables para soporte/Lovable.
 * Captura: versión, ruta, usuario+organización, user agent, viewport, fase,
 * mensaje, código Postgrest/HTTP, stack y `context` arbitrario por call site.
 */
import { APP_VERSION } from "@/constants/appVersion";
import { getAuthSnapshot } from "@/lib/ui/authSnapshot";
import { extractErrorDetails } from "./errorDetailsExtract";
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
}

export interface ErrorReport {
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
  };
  context?: Record<string, unknown>;
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

  return {
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
    errorDetails: extractErrorDetails(input.error),
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
